import { getServiceClient } from '@/lib/supabase/server'

/**
 * Sliding-window rate limit basé sur Postgres.
 *
 * On insère un event dans `rate_limit_events` à chaque appel et on count les
 * events de la fenêtre. Au-delà du seuil → deny.
 *
 * Bucket recommandé : `<route>:<hashed-ip>` ou `<route>:<guest_id>`.
 */
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number }> {
  const service = getServiceClient()
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString()

  // Count d'abord pour décider si on accepte.
  const { count: existing } = await service
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .gte('occurred_at', since)

  const count = existing ?? 0
  if (count >= limit) {
    return { allowed: false, count }
  }

  // Insertion best-effort. Si elle échoue, on laisse passer (préfère le faux
  // negatif au faux positif sur ce projet).
  await service.from('rate_limit_events').insert({ bucket })
  return { allowed: true, count: count + 1 }
}
