import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { getServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Tâche mensuelle :
 *   - purge des events de rate-limit > 24h
 *   - (à activer post-mariage) purge des contenus utilisateurs > J+180
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const service = getServiceClient()
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // delete().select() renvoie les rows supprimées → on connaît le count via length
  const { data: rateRows, error: rateErr } = await service
    .from('rate_limit_events')
    .delete()
    .lt('occurred_at', dayAgo)
    .select('id')

  if (rateErr) {
    console.error('[cron/cleanup:rate]', rateErr)
  }

  // Post-mariage cleanup : on supprime contenus > J+180.
  let purgedQuizz = 0
  let purgedPhotos = 0
  let purgedMessages = 0
  const weddingISO = process.env.NEXT_PUBLIC_WEDDING_DATE
  if (weddingISO) {
    const cutoff = new Date(weddingISO).getTime() + 180 * 24 * 60 * 60 * 1000
    if (Date.now() > cutoff) {
      const cutoffISO = new Date(cutoff).toISOString()
      const [a, p, m] = await Promise.all([
        service.from('quizz').delete().lt('created_at', cutoffISO).select('id'),
        service.from('photos').delete().lt('created_at', cutoffISO).select('id'),
        service.from('cagnotte_messages').delete().lt('created_at', cutoffISO).select('id'),
      ])
      purgedQuizz = a.data?.length ?? 0
      purgedPhotos = p.data?.length ?? 0
      purgedMessages = m.data?.length ?? 0
    }
  }

  return NextResponse.json({
    ok: true,
    rate_events_purged: rateRows?.length ?? 0,
    purged_quizz: purgedQuizz,
    purged_photos: purgedPhotos,
    purged_messages: purgedMessages,
  })
}
