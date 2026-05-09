import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { getServiceClient } from '@/lib/supabase/server'
import { getWiseBalance } from '@/lib/wise'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const balance = await getWiseBalance()
  if (!balance) {
    return NextResponse.json(
      { ok: false, reason: 'wise_unavailable_or_unconfigured' },
      { status: 502 },
    )
  }

  const service = getServiceClient()
  // Singleton row id=1 inserted in 0001_initial.sql, on a juste à update.
  const { error } = await service
    .from('cagnotte_balance_cache')
    .update({
      amount_cents: balance.amount_cents,
      currency: balance.currency,
      fetched_at: balance.fetched_at.toISOString(),
    })
    .eq('id', 1)

  if (error) {
    console.error('[cron/sync-wise]', JSON.stringify(error))
    return NextResponse.json(
      { ok: false, error: 'db_failed', detail: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    amount_cents: balance.amount_cents,
    currency: balance.currency,
    fetched_at: balance.fetched_at.toISOString(),
  })
}
