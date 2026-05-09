'use server'

import { after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { accessSchema } from '@/lib/validators'
import { getServiceClient } from '@/lib/supabase/server'
import { getClientIPHash } from '@/lib/ip'
import { checkRateLimit } from '@/lib/rate-limit'
import { randomDelayMs, sleep } from '@/lib/crypto'

const SAME_RESPONSE = {
  status: 'sent' as const,
  message: "Si ton email est dans la liste, tu vas recevoir un lien d'ici quelques minutes.",
}

/**
 * Server Action /access — comportement constant-time et indistinguable.
 *
 * 3 cas, MÊME réponse UI, MÊME délai approximatif :
 *   1. Email match un guest non-blocké → genère lien magique + envoie email
 *   2. Email ne match aucun guest → silence (pas d'email)
 *   3. Email match un guest avec is_blocked=true (Brice/Alix) → silence total
 *
 * Pour atténuer les timing attacks, on ajoute systématiquement un délai
 * aléatoire entre 250ms et 500ms avant de renvoyer.
 */
export async function requestAccessLink(formData: FormData): Promise<{
  status: 'sent' | 'rate_limited' | 'invalid'
  message: string
}> {
  const startedAt = Date.now()

  // Validation
  const parsed = accessSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    await padDelay(startedAt)
    return { status: 'invalid', message: "Cette adresse a l'air bancale." }
  }
  const { email } = parsed.data

  // Rate limit par IP — 5/h
  let ipBucket: string
  try {
    ipBucket = await getClientIPHash()
  } catch {
    ipBucket = 'unknown'
  }
  const rl = await checkRateLimit(`access:${ipBucket}`, 5, 3600)
  if (!rl.allowed) {
    await padDelay(startedAt)
    return {
      status: 'rate_limited',
      message: 'Tu as fait plusieurs tentatives. Reviens dans une heure.',
    }
  }

  const service = getServiceClient()

  // Lookup — best effort, on ignore les erreurs
  const { data: guest } = await service
    .from('guests')
    .select('id, is_blocked')
    .eq('email', email)
    .maybeSingle()

  // Cas non-blockés uniquement → demander à Supabase d'envoyer le magic link
  // via le SMTP configuré (Gmail). Le template `magic_link.html` produit une
  // URL vers notre /auth/callback?token_hash=...&type=magiclink que verifyOtp
  // gère côté serveur et qui pose le cookie de session.
  //
  // Délégué à `after()` pour ne PAS allonger le temps de réponse — sinon une
  // mesure du temps de réponse permettrait de distinguer "guest valide" de
  // "guest inconnu/blocké". Tout doit revenir à `padDelay` au même rythme.
  if (guest && !guest.is_blocked) {
    const guestId = guest.id
    after(async () => {
      try {
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
          console.error('[access:after] signInWithOtp', error)
          return
        }
        await service
          .from('guests')
          .update({ link_sent_at: new Date().toISOString() })
          .eq('id', guestId)
      } catch (err) {
        console.error('[access:after]', err)
      }
    })
  }

  await padDelay(startedAt)
  return SAME_RESPONSE
}

/**
 * Garantit un délai total d'au moins 350ms (jitter ±150ms) sur tous les
 * chemins, pour ne pas leaker via le temps de réponse.
 */
async function padDelay(startedAt: number) {
  const elapsed = Date.now() - startedAt
  const target = randomDelayMs(350, 600)
  if (elapsed < target) {
    await sleep(target - elapsed)
  }
}

