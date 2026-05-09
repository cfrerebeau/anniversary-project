import { Resend } from 'resend'

const SECRET_FOOTER =
  '\n\n— 🤫 Brice & Alix ne savent pas qu\'on prépare ça. Garde le secret.'

let _resend: Resend | null = null
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!_resend) _resend = new Resend(key)
  return _resend
}

export type EmailPayload = {
  to: string | string[]
  subject: string
  text: string
  html?: string
}

/**
 * Envoie un email via Resend. Si RESEND_API_KEY n'est pas configurée, log à la
 * console et renvoie { ok: true, simulated: true } — utile en dev et tant que
 * la domain Resend n'est pas configurée.
 */
export async function sendEmail(
  payload: EmailPayload,
): Promise<{ ok: boolean; id?: string; simulated?: boolean; error?: string }> {
  const resend = getResend()
  const from = process.env.RESEND_FROM_EMAIL || 'noreply@example.com'
  const text = `${payload.text.trimEnd()}${SECRET_FOOTER}`

  if (!resend) {
    console.log('[email:simulated]', { to: payload.to, subject: payload.subject, text })
    return { ok: true, simulated: true }
  }

  const { data, error } = await resend.emails.send({
    from,
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    subject: payload.subject,
    text,
    html: payload.html,
  })

  if (error) {
    console.error('[email:error]', error)
    return { ok: false, error: error.message }
  }
  return { ok: true, id: data?.id }
}
