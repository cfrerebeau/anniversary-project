/**
 * Wrapper minimaliste autour de l'API Wise — endpoint `balances` uniquement.
 * Ne nécessite pas de SCA / RSA en v1.
 *
 * Référence : https://docs.wise.com/api-docs/api-reference/balance#list-balances
 */
type WiseBalance = {
  id: number
  amount: { value: number; currency: string }
  currency: string
}

const WISE_API_BASE = 'https://api.wise.com'

export async function getWiseBalance(): Promise<{
  amount_cents: number
  currency: string
  fetched_at: Date
} | null> {
  const token = process.env.WISE_API_TOKEN
  const profileId = process.env.WISE_PROFILE_ID
  const balanceId = process.env.WISE_BALANCE_ID

  if (!token || !profileId) {
    return null
  }

  const url = `${WISE_API_BASE}/v4/profiles/${profileId}/balances?types=STANDARD`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    console.error(`Wise balance fetch failed: ${res.status} ${res.statusText}`)
    return null
  }

  const balances = (await res.json()) as WiseBalance[]
  const target = balanceId
    ? balances.find((b) => String(b.id) === String(balanceId))
    : balances.find((b) => b.currency === 'EUR')

  if (!target) return null

  return {
    amount_cents: Math.round(target.amount.value * 100),
    currency: target.amount.currency.toLowerCase(),
    fetched_at: new Date(),
  }
}
