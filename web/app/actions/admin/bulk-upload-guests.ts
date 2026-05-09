'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'

const schema = z.object({
  csv: z.string().trim().min(1).max(200_000),
})

const emailSchema = z.string().trim().toLowerCase().email()

export type BulkUploadResult = {
  status: 'ok' | 'invalid' | 'error'
  imported: number
  skipped: number
  invalidRows: { line: number; reason: string }[]
  message: string
}

function capitalize(name: string): string {
  const s = name.trim()
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1).toLowerCase()
}

type ParsedRow = { email: string; full_name: string }

function parseCsv(raw: string): {
  rows: ParsedRow[]
  invalid: { line: number; reason: string }[]
  headerError?: string
} {
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .map((l, i) => ({ line: i + 1, text: l }))
    .filter((l) => l.text.trim().length > 0)

  if (lines.length === 0) {
    return { rows: [], invalid: [], headerError: 'CSV vide.' }
  }

  const header = lines[0].text.split(',').map((s) => s.trim().toLowerCase())
  if (header.length !== 2 || header[0] !== 'email' || header[1] !== 'firstname') {
    return {
      rows: [],
      invalid: [],
      headerError: 'En-tête attendue : `email,firstname` sur la première ligne.',
    }
  }

  const seen = new Map<string, ParsedRow>()
  const invalid: { line: number; reason: string }[] = []

  for (const { line, text } of lines.slice(1)) {
    const commaIdx = text.indexOf(',')
    if (commaIdx === -1) {
      invalid.push({ line, reason: 'virgule manquante' })
      continue
    }
    const rawEmail = text.slice(0, commaIdx)
    const rawFirstname = text.slice(commaIdx + 1)
    const emailParsed = emailSchema.safeParse(rawEmail)
    if (!emailParsed.success) {
      invalid.push({ line, reason: `email invalide : ${rawEmail.trim() || '(vide)'}` })
      continue
    }
    const firstname = capitalize(rawFirstname)
    if (!firstname) {
      invalid.push({ line, reason: 'prénom manquant' })
      continue
    }
    seen.set(emailParsed.data, { email: emailParsed.data, full_name: firstname })
  }

  return { rows: [...seen.values()], invalid }
}

export async function bulkUploadGuests(formData: FormData): Promise<BulkUploadResult> {
  await requireAdmin()

  const parsed = schema.safeParse({ csv: formData.get('csv') })
  if (!parsed.success) {
    return {
      status: 'invalid',
      imported: 0,
      skipped: 0,
      invalidRows: [],
      message: 'CSV vide ou trop volumineux.',
    }
  }

  const { rows, invalid, headerError } = parseCsv(parsed.data.csv)
  if (headerError) {
    return {
      status: 'invalid',
      imported: 0,
      skipped: 0,
      invalidRows: [],
      message: headerError,
    }
  }

  if (rows.length === 0) {
    return {
      status: 'invalid',
      imported: 0,
      skipped: 0,
      invalidRows: invalid,
      message: 'Aucune ligne valide à importer.',
    }
  }

  const service = getServiceClient()
  const { data: inserted, error } = await service
    .from('guests')
    .upsert(
      rows.map((r) => ({ email: r.email, full_name: r.full_name, is_blocked: false })),
      { onConflict: 'email', ignoreDuplicates: true },
    )
    .select('email')

  if (error) {
    console.error('[admin/bulk-upload-guests] upsert', error)
    return {
      status: 'error',
      imported: 0,
      skipped: 0,
      invalidRows: invalid,
      message: error.message,
    }
  }

  const imported = inserted?.length ?? 0
  const skipped = rows.length - imported

  revalidatePath('/admin/guests')
  revalidatePath('/admin')

  const parts = [
    `${imported} importé${imported > 1 ? 's' : ''}`,
    `${skipped} déjà présent${skipped > 1 ? 's' : ''} ignoré${skipped > 1 ? 's' : ''}`,
  ]
  if (invalid.length > 0) {
    parts.push(`${invalid.length} ligne${invalid.length > 1 ? 's' : ''} invalide${invalid.length > 1 ? 's' : ''}`)
  }

  return {
    status: 'ok',
    imported,
    skipped,
    invalidRows: invalid,
    message: parts.join(', ') + '.',
  }
}
