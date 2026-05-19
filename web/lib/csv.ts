// Formula-injection-safe CSV cell. Prefixes leading =, +, -, @, tab or CR
// with a single quote so Excel/Numbers/Sheets render the value as text instead
// of evaluating it as a formula. Always wraps non-empty cells in double quotes
// with internal quotes doubled per RFC 4180.
const FORMULA_PREFIXES = /^[=+\-@\t\r]/

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const s = String(value)
  const safe = FORMULA_PREFIXES.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export function csvRow(values: ReadonlyArray<string | number | null | undefined>): string {
  return values.map(csvCell).join(',')
}
