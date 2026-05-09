'use server'

import { after } from 'next/server'
import { accessSchema } from '@/lib/validators'
import { getServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
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

  // Cas non-blockés uniquement → générer + envoyer.
  //
  // IMPORTANT : le travail "lourd" (generateLink + sendEmail Resend + update DB)
  // est délégué à `after()` pour ne PAS allonger le temps de réponse — sinon
  // une mesure du temps de réponse permettrait de distinguer "guest valide" de
  // "guest inconnu/blocké". Tout doit revenir à `padDelay` au même rythme.
  if (guest && !guest.is_blocked) {
    const guestId = guest.id
    after(async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const { data, error } = await service.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo: `${baseUrl}/auth/callback` },
        })
        if (error || !data?.properties?.action_link) return
        await sendEmail({
          to: email,
          subject: 'Ton lien pour le cabanon',
          text: [
            'Salut,',
            '',
            "Voici ton lien d'accès au cabanon. Un seul clic, pas de mot de passe :",
            '',
            data.properties.action_link,
            '',
            'Le lien expire dans une heure. Si besoin, reviens redemander un lien.',
          ].join('\n'),
        })
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

