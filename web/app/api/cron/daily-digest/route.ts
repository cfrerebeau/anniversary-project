import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { getServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Reçoivent le digest : les ORGANISATEURS, surtout PAS le couple.
  // Si quelqu'un avait par erreur mis brice@... ou alix@... ici, le contenu
  // (anecdotes en clair, total cagnotte, etc.) cracherait la surprise.
  const recipients = (process.env.ORGANIZER_NOTIFICATION_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'no_recipients' })
  }

  const service = getServiceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: anecdotes, count: anecdoteCount }, { data: photos, count: photoCount }, { data: messages, count: msgCount }, { data: balance }] = await Promise.all([
    service
      .from('anecdotes')
      .select('title, story, uploader_name, created_at', { count: 'exact' })
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
    service
      .from('photos')
      .select('uploader_name, caption, created_at', { count: 'exact' })
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
    service
      .from('cagnotte_messages')
      .select('display_name, amount_cents, message, created_at', { count: 'exact' })
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
    service.from('cagnotte_balance_cache').select('amount_cents').eq('id', 1).single(),
  ])

  if ((anecdoteCount ?? 0) + (photoCount ?? 0) + (msgCount ?? 0) === 0) {
    // Pas de mouvement → on n'envoie pas pour ne pas spammer.
    return NextResponse.json({ ok: true, skipped: 'no_activity' })
  }

  const lines = [
    `Rapport du ${new Date().toLocaleDateString('fr-FR')}`,
    '',
    `Cagnotte : ${(balance?.amount_cents ?? 0) / 100} €`,
    `Anecdotes (24h) : ${anecdoteCount ?? 0}`,
    `Photos (24h) : ${photoCount ?? 0}`,
    `Messages (24h) : ${msgCount ?? 0}`,
    '',
  ]

  if (anecdotes && anecdotes.length > 0) {
    lines.push('## Anecdotes')
    for (const a of anecdotes) {
      lines.push(`— ${a.uploader_name ?? 'Anonyme'} : "${a.title ?? '(sans titre)'}"`)
      lines.push(a.story.slice(0, 200) + (a.story.length > 200 ? '…' : ''))
      lines.push('')
    }
  }

  if (photos && photos.length > 0) {
    lines.push('## Photos')
    for (const p of photos) {
      lines.push(`— ${p.uploader_name ?? 'Anonyme'} : ${p.caption || '(sans légende)'}`)
    }
    lines.push('')
  }

  if (messages && messages.length > 0) {
    lines.push('## Messages cagnotte')
    for (const m of messages) {
      const eur = m.amount_cents ? `${m.amount_cents / 100}€ ` : ''
      lines.push(`— ${m.display_name ?? 'Anonyme'} : ${eur}${m.message || ''}`)
    }
  }

  await sendEmail({
    to: recipients,
    subject: 'Bilan des dernières 24h',
    text: lines.join('\n'),
  })

  return NextResponse.json({
    ok: true,
    counts: { anecdotes: anecdoteCount, photos: photoCount, messages: msgCount },
  })
}
