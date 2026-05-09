#!/usr/bin/env tsx
/**
 * Usage : pnpm invite path/to/guests.csv
 *
 * CSV attendu :
 *   email,full_name,is_blocked
 *   alice@email.fr,Alice Dupont,false
 *   bob@email.fr,Bob Martin,false
 *   brice@email.fr,Brice,true
 *
 * Pour chaque ligne :
 *   - upsert dans `guests`
 *   - si is_blocked=false : génère le magic link Supabase et l'envoie via Resend
 *     (ou affiche l'URL en console si Resend n'est pas configuré)
 *   - update link_sent_at
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

loadEnv({ path: '.env.local' })

const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY')
const BASE_URL = required('NEXT_PUBLIC_BASE_URL')
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@example.com'

function required(key: string): string {
  const v = process.env[key]
  if (!v) {
    console.error(`Missing env var: ${key}`)
    process.exit(1)
  }
  return v
}

type Row = { email: string; full_name: string | null; is_blocked: boolean }

function parseCSV(content: string): Row[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'))
  if (lines.length === 0) return []
  const header = lines[0].split(',').map((s) => s.trim().toLowerCase())
  const idxEmail = header.indexOf('email')
  const idxName = header.indexOf('full_name')
  const idxBlocked = header.indexOf('is_blocked')
  if (idxEmail === -1) {
    throw new Error('CSV must have an "email" column')
  }
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return {
      email: cells[idxEmail].trim().toLowerCase(),
      full_name: idxName >= 0 ? cells[idxName].trim() || null : null,
      is_blocked:
        idxBlocked >= 0 ? /^(true|1|yes|y)$/i.test(cells[idxBlocked].trim()) : false,
    }
  })
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        cur += c
      }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') {
        out.push(cur)
        cur = ''
      } else cur += c
    }
  }
  out.push(cur)
  return out
}

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: pnpm invite path/to/guests.csv')
    process.exit(1)
  }
  const csv = readFileSync(resolve(file), 'utf8')
  const rows = parseCSV(csv)
  console.log(`→ ${rows.length} rows parsed`)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

  let upserted = 0
  let invited = 0
  let skipped = 0

  for (const row of rows) {
    const { data, error: upsertErr } = await supabase
      .from('guests')
      .upsert(
        {
          email: row.email,
          full_name: row.full_name,
          is_blocked: row.is_blocked,
        },
        { onConflict: 'email' },
      )
      .select('id')
      .single()

    if (upsertErr || !data) {
      console.error(`  ✗ ${row.email} — upsert failed:`, upsertErr?.message)
      continue
    }
    upserted++

    if (row.is_blocked) {
      console.log(`  · ${row.email} — blocked (no link)`)
      skipped++
      continue
    }

    const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: row.email,
      options: { redirectTo: `${BASE_URL}/auth/callback` },
    })
    if (linkErr || !link?.properties?.action_link) {
      console.error(`  ✗ ${row.email} — generateLink failed:`, linkErr?.message)
      continue
    }
    const url = link.properties.action_link
    const firstName = row.full_name?.split(' ')[0] ?? row.email.split('@')[0]

    const text = [
      `Salut ${firstName},`,
      '',
      'On prépare une surprise pour Brice & Alix — un cadeau collectif et de quoi remplir un beau jour de mariage. Tu fais partie des complices.',
      '',
      'Voici ton lien d\'accès (un seul clic, pas de mot de passe) :',
      url,
      '',
      "Le lien expire dans une heure. Si besoin, demande-le à nouveau depuis le site.",
    ].join('\n')

    if (resend) {
      const { error: emailErr } = await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: [row.email],
        subject: "Ton lien d'accès",
        text: `${text}\n\n— 🤫 Brice & Alix ne savent pas qu'on prépare ça. Garde le secret.`,
      })
      if (emailErr) {
        console.error(`  ✗ ${row.email} — Resend failed:`, emailErr.message)
        continue
      }
      console.log(`  ✓ ${row.email} — emailed`)
    } else {
      console.log(`  ✓ ${row.email}`)
      console.log(`     ${url}`)
    }

    await supabase
      .from('guests')
      .update({ link_sent_at: new Date().toISOString() })
      .eq('id', data.id)
    invited++
  }

  console.log('\nDone.')
  console.log(`  upserted: ${upserted}`)
  console.log(`  invited:  ${invited}`)
  console.log(`  skipped:  ${skipped}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
