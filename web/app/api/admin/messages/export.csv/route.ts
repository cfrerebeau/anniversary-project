import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { csvRow } from '@/lib/csv'

export const dynamic = 'force-dynamic'

type ExportRow = {
  created_at: string
  display_name: string | null
  amount_cents: number | null
  message: string | null
  guests: { email: string; full_name: string | null } | null
}

export async function GET() {
  const guest = await getCurrentGuest()
  if (!guest) return new Response('Unauthorized', { status: 401 })
  if (!guest.is_admin) return new Response('Forbidden', { status: 403 })

  const service = getServiceClient()
  const { data, error } = await service
    .from('cagnotte_messages')
    .select('created_at, display_name, amount_cents, message, guests(email, full_name)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/messages/export]', error)
    return new Response('Server error', { status: 500 })
  }

  const rows = (data ?? []) as unknown as ExportRow[]

  const header = csvRow([
    'created_at',
    'display_name',
    'guest_email',
    'guest_full_name',
    'amount_eur',
    'message',
  ])

  const body = rows.map((r) =>
    csvRow([
      r.created_at,
      r.display_name,
      r.guests?.email ?? null,
      r.guests?.full_name ?? null,
      r.amount_cents != null ? (r.amount_cents / 100).toFixed(2) : null,
      r.message,
    ]),
  )

  // UTF-8 BOM so Excel opens accents correctly.
  const csv = '﻿' + [header, ...body].join('\r\n') + '\r\n'

  const filename = `cagnotte-messages-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
