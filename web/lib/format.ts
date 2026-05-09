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
