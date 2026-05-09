import { getServiceClient } from '@/lib/supabase/server'
import { getWiseBalance } from '@/lib/wise'

/**
 * Total cagnotte en cents — live Wise + fallback cache.
 *
 * Source unique partagée entre `/` et `/cagnotte` pour qu'on n'ait pas une
 * page qui montre une valeur fraîche et l'autre une valeur de plusieurs
 * heures (cache rafraîchi par le cron quotidien). Si Wise est down ou les
 * env vars ne sont pas configurées, on tombe sur le cache pour ne jamais
 * afficher 0 € sur une coupure transitoire.
 */
export async function getCagnotteTotalCents(): Promise<number> {
  const service = getServiceClient()
  // `getWiseBalance` renvoie déjà null sur une réponse non-OK, mais peut
  // throw sur une erreur réseau / DNS / abort — on isole pour préserver le
  // fallback cache dans tous les cas, sinon `Promise.all` rejecterait et
  // ferait 500 sur la home et /cagnotte.
  const [balance, cache] = await Promise.all([
    getWiseBalance().catch((err) => {
      console.error('[cagnotte] getWiseBalance threw', err)
      return null
    }),
    service.from('cagnotte_balance_cache').select('amount_cents').eq('id', 1).single(),
  ])
  return balance?.amount_cents ?? cache.data?.amount_cents ?? 0
}
