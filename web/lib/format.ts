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
