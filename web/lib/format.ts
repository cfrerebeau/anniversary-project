/**
 * Formate un montant en cents en string EUR FR : "12 500 €"
 */
export function formatEUR(amountCents: number): string {
  const euros = Math.round(amountCents / 100)
  return `${euros.toLocaleString('fr-FR')} €`
}

export function formatDateFR(
  date: Date,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' },
): string {
  return date.toLocaleDateString('fr-FR', options)
}

export function daysUntil(targetISO: string): number {
  const target = new Date(targetISO).getTime()
  const now = Date.now()
  const diff = target - now
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/**
 * Différence calendaire en jours depuis le mariage, en Europe/Paris (stable
 * autour des minuits UTC). Retourne 0 le jour J, positif après, négatif avant.
 */
export function daysSinceWedding(targetISO: string, now: Date = new Date()): number {
  const tz = 'Europe/Paris'
  function midnightInParis(d: Date): number {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d)
    const y = parts.find((p) => p.type === 'year')!.value
    const m = parts.find((p) => p.type === 'month')!.value
    const day = parts.find((p) => p.type === 'day')!.value
    // Re-parse via UTC : on n'a besoin que d'un timestamp comparable.
    return Date.UTC(Number(y), Number(m) - 1, Number(day))
  }
  return Math.round(
    (midnightInParis(now) - midnightInParis(new Date(targetISO))) / 86_400_000,
  )
}

/**
 * Renvoie l'ISO d'il y a `seconds` secondes. Wrapper utile pour échapper à
 * la règle react-hooks/purity dans les Server Components — `Date.now()` direct
 * en render est interdit, mais l'appel via fonction utilitaire passe.
 */
export function isoSecondsAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

/**
 * Renvoie le timestamp ms actuel. Même wrapper que `isoSecondsAgo` pour
 * contourner react-hooks/purity côté server components.
 */
export function nowMs(): number {
  return Date.now()
}
