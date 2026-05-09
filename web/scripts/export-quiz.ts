#!/usr/bin/env tsx
/**
 * Usage : pnpm export-quiz [--out ../Quizz/src/Quizz/questions.json]
 *
 * Lit toutes les questions soumises via /quizz et produit un JSON
 * compatible avec le binaire Quizz (C# QuizConfig) :
 *
 *   { "title": "...", "defaultTimeLimit": 20, "questions": [
 *       { "text": "...", "options": ["A","B"], "correctIndex": 0, "uploaderName": "..." }
 *   ] }
 *
 * Par défaut, écrit dans `../Quizz/src/Quizz/questions.json` (relatif au
 * répertoire courant `web/`). Surcharge via `--out` ou `QUIZ_OUTPUT_PATH`.
 *
 * Le titre et le defaultTimeLimit sont surchargeables via env :
 *   QUIZ_TITLE="20 ans de Mariage ;-)"
 *   QUIZ_DEFAULT_TIME_LIMIT=20
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: '.env.local' })

const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY')

const QUIZ_TITLE = process.env.QUIZ_TITLE ?? 'Brice & Alix — le quiz'
const QUIZ_DEFAULT_TIME_LIMIT = Number(process.env.QUIZ_DEFAULT_TIME_LIMIT ?? '20')

function required(key: string): string {
  const v = process.env[key]
  if (!v) {
    console.error(`Missing env var: ${key}`)
    process.exit(1)
  }
  return v
}

function getOutPath(): string {
  const flagIdx = process.argv.indexOf('--out')
  if (flagIdx !== -1 && process.argv[flagIdx + 1]) {
    return resolve(process.argv[flagIdx + 1])
  }
  if (process.env.QUIZ_OUTPUT_PATH) {
    return resolve(process.env.QUIZ_OUTPUT_PATH)
  }
  return resolve('../Quizz/src/Quizz/questions.json')
}

type Row = {
  id: string
  question_text: string
  options: unknown
  correct_index: number
  uploader_name: string | null
  created_at: string
}

type OutQuestion = {
  text: string
  options: string[]
  correctIndex: number
  uploaderName: string | null
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('quizz')
    .select('id, question_text, options, correct_index, uploader_name, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Supabase error:', error.message)
    process.exit(1)
  }

  const rows = (data ?? []) as Row[]
  console.log(`→ ${rows.length} questions in DB`)

  const questions: OutQuestion[] = []
  let skipped = 0

  for (const r of rows) {
    if (!isStringArray(r.options) || r.options.length < 2 || r.options.length > 4) {
      console.warn(`  ✗ skip ${r.id} — options invalides`)
      skipped++
      continue
    }
    if (r.correct_index < 0 || r.correct_index >= r.options.length) {
      console.warn(`  ✗ skip ${r.id} — correct_index hors plage`)
      skipped++
      continue
    }
    questions.push({
      text: r.question_text,
      options: r.options,
      correctIndex: r.correct_index,
      uploaderName: r.uploader_name,
    })
  }

  const out = {
    title: QUIZ_TITLE,
    defaultTimeLimit: QUIZ_DEFAULT_TIME_LIMIT,
    questions,
  }

  const outPath = getOutPath()
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8')

  console.log(`\n✓ Wrote ${questions.length} questions → ${outPath}`)
  if (skipped > 0) console.log(`  (${skipped} skipped)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
