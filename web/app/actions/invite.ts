'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { inviteSchema } from '@/lib/validators'
import { getServerClient, getServiceClient } from '@/lib/supabase/server'
import { getClientIPHash } from '@/lib/ip'
import { checkRateLimit } from '@/lib/rate-limit'
import { checkInviteSlug } from '@/lib/invite'

export type InviteResult =
  | { status: 'invalid'; message: string; field?: 'email' | 'first_name' }
  | { status: 'rate_limited'; message: string }
  | { status: 'forbidden'; message: string }
  | { status: 'sent'; message: string }
  | { status: 'error'; message: string }

const FORBIDDEN_MESSAGE = 'Lien invalide ou accès refusé.'

/**
 * Sign-up + sign-in via le lien global /invite/[slug].
 *
 * Deux branches :
 *
 *   • Email INCONNU   → on crée le guest, on crée l'auth user, on génère un OTP
 *                       côté serveur, on le `verifyOtp` (pose le cookie) et on
 *                       redirect('/'). Sign-in instantané.
 *
 *   • Email CONNU     → on n'auto-signe PAS la session : on envoie un magic
 *                       link Supabase à l'email du guest existant. Cela évite
 *                       qu'un porteur du slug se fasse passer pour un invité
 *                       déjà inscrit (squat d'identité). L'invité ouvre son
 *                       mail et clique → flow /access standard.
 *
 * Le slug est passé en hidden input parce que le Server Action est joignable
 * indépendamment de la page : on revérifie ici (via `checkInviteSlug`).
 *
 * Toute erreur inattendue est mappée à `status:'error'` avec un message
 * générique pour ne pas leaker.
 */
export async function registerAndSignIn(formData: FormData): Promise<InviteResult> {
  const slug = String(formData.get('slug') ?? '')
  const slugCheck = checkInviteSlug(slug)
  if (slugCheck === 'wrong_slug') {
    return { status: 'forbidden', message: FORBIDDEN_MESSAGE }
  }
  if (slugCheck === 'expired') {
    return { status: 'forbidden', message: 'Ce lien est expiré.' }
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    first_name: formData.get('first_name'),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0]
    return {
      status: 'invalid',
      message:
        field === 'first_name'
          ? 'Mets un prénom (au moins 1 caractère).'
          : "Cette adresse a l'air bancale.",
      field: field === 'first_name' ? 'first_name' : 'email',
    }
  }
  const { email, first_name } = parsed.data

  let ipBucket: string
  try {
    ipBucket = await getClientIPHash()
  } catch {
    ipBucket = 'unknown'
  }
  // 30/h pour absorber le venue Wi-Fi (NAT partagé entre invités) sans laisser
  // un attaquant scanner les emails à volonté.
  const rl = await checkRateLimit(`invite:${ipBucket}`, 30, 3600)
  if (!rl.allowed) {
    return {
      status: 'rate_limited',
      message: 'Tu as fait plusieurs tentatives. Reviens dans une heure.',
    }
  }

  const service = getServiceClient()

  const { data: existing, error: lookupErr } = await service
    .from('guests')
    .select('id, full_name, is_blocked')
    .eq('email', email)
    .maybeSingle()
  if (lookupErr) {
    console.error('[invite] guests select failed', lookupErr)
    return { status: 'error', message: 'Petit souci côté serveur. Réessaie.' }
  }

  // Réponse identique pour "blocked" et "wrong slug" — pas d'oracle d'énumération.
  if (existing?.is_blocked) {
    return { status: 'forbidden', message: FORBIDDEN_MESSAGE }
  }

  if (existing) {
    // Best-effort : ne renseigne le full_name que s'il n'a jamais été rempli.
    // `.is('full_name', null)` rend l'update no-op si une autre requête a
    // déjà posé un nom (race avec /admin/guests ou avec l'invite-script CSV).
    if (!existing.full_name) {
      const { error: updateErr } = await service
        .from('guests')
        .update({ full_name: first_name })
        .eq('id', existing.id)
        .is('full_name', null)
      if (updateErr) console.error('[invite] update full_name failed', updateErr)
    }

    // Email connu → on n'auto-signe pas. On envoie un magic link via SMTP
    // Supabase comme /access. Le guest ouvre son mail, clique, et arrive
    // authentifié sur /. Aucune session n'est posée ici.
    return await sendMagicLink(email)
  }

  // Email INCONNU → instant sign-in.

  // Insert atomique : si une requête concurrente vient juste de créer la même
  // ligne, on récupère son id silencieusement (pas d'erreur 23505 visible).
  const { data: inserted, error: insertErr } = await service
    .from('guests')
    .upsert(
      { email, full_name: first_name },
      { onConflict: 'email', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle()
  if (insertErr) {
    console.error('[invite] guest upsert failed', insertErr)
    return { status: 'error', message: 'Petit souci côté serveur. Réessaie.' }
  }
  // Si le insert a été ignoré (race), `inserted` est null → on retombe sur le
  // flow "email connu" pour ne pas auto-signer une identité fraîchement créée
  // par quelqu'un d'autre.
  if (!inserted) {
    return await sendMagicLink(email)
  }

  // Provisionne l'auth user (idempotent : on ignore email_exists).
  const { error: createErr } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (createErr && (createErr as { code?: string }).code !== 'email_exists') {
    console.error('[invite] createUser failed', createErr)
    return { status: 'error', message: 'Petit souci côté serveur. Réessaie.' }
  }

  const { data: link, error: linkErr } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !link?.properties?.hashed_token) {
    console.error('[invite] generateLink failed', linkErr)
    return { status: 'error', message: 'Petit souci côté serveur. Réessaie.' }
  }

  const serverClient = await getServerClient()
  const { error: verifyErr } = await serverClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyErr) {
    console.error('[invite] verifyOtp failed', verifyErr)
    return { status: 'error', message: 'Petit souci côté serveur. Réessaie.' }
  }

  redirect('/')
}

async function sendMagicLink(email: string): Promise<InviteResult> {
  // Anon client (pas service_role) — `signInWithOtp` envoie l'email via SMTP
  // Supabase. `shouldCreateUser: false` : on ne veut pas que cette branche
  // crée des auth.users à la volée (la branche "instant sign-in" s'en charge).
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error } = await anon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (error) {
    console.error('[invite] signInWithOtp failed', error)
    return { status: 'error', message: 'Petit souci côté serveur. Réessaie.' }
  }
  return {
    status: 'sent',
    message: 'Tu es déjà dans la liste — on vient de t\'envoyer un lien d\'accès par email.',
  }
}
