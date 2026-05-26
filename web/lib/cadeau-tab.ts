export type CadeauTabKey = 'mots' | 'avant' | 'fete'

export const CADEAU_TAB_DEFAULT: CadeauTabKey = 'fete'

/**
 * Parse une valeur de query `tab` provenant de `searchParams`. Refuse les
 * valeurs multiples (anti-pollution) et fallback au default 'fete'.
 */
export function parseCadeauTab(raw: string | string[] | undefined): CadeauTabKey {
  if (Array.isArray(raw)) return CADEAU_TAB_DEFAULT
  if (raw === 'mots' || raw === 'avant' || raw === 'fete') return raw
  return CADEAU_TAB_DEFAULT
}
