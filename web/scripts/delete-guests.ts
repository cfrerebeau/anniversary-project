#!/usr/bin/env tsx
/**
 * One-shot : supprime des invités du couple (Brice & Alix) à la fois de
 * `public.guests` ET de `auth.users`. Lit les emails passés en argv ou
 * la liste hardcodée par défaut.
 *
 * Usage : pnpm exec tsx scripts/delete-guests.ts [email...]
 */
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: '.env.local' })

const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY')

function required(key: string): string {
  const v = process.env[key]
  if (!v) {
    console.error(`Missing env var: ${key}`)
    process.exit(1)
  }
  return v
}

async function main() {
  const argv = process.argv.slice(2)
  const emails = (argv.length > 0
    ? argv
    : ['alix.demarcillac@gmail.com', 'brice.demarcillac@gmail.com']
  ).map((e) => e.trim().toLowerCase())

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`→ Cible : ${emails.join(', ')}\n`)

  for (const email of emails) {
    // 1. Lookup public.guests
    const { data: guest, error: lookupErr } = await supabase
      .from('guests')
      .select('id, email, full_name, is_blocked, is_admin, first_visit_at')
      .eq('email', email)
      .maybeSingle()

    if (lookupErr) {
      console.error(`  ✗ ${email} — lookup failed:`, lookupErr.message)
      continue
    }

    if (!guest) {
      console.log(`  · ${email} — pas dans public.guests`)
    } else {
      console.log(
        `  · ${email} — guest ${guest.id}${guest.is_admin ? ' [ADMIN]' : ''}${guest.is_blocked ? ' [bloqué]' : ''}${guest.first_visit_at ? ' [s\'est connecté]' : ''}`,
      )
      const { error: delErr } = await supabase.from('guests').delete().eq('id', guest.id)
      if (delErr) {
        console.error(`  ✗ ${email} — delete guests failed:`, delErr.message)
        continue
      }
      console.log(`  ✓ ${email} — supprimé de public.guests`)
    }

    // 2. Lookup et delete auth.users (peut exister sans guest, ou inversement)
    const authUser = await findAuthUserByEmail(supabase, email)
    if (!authUser) {
      console.log(`  · ${email} — pas dans auth.users`)
    } else {
      const { error: authDelErr } = await supabase.auth.admin.deleteUser(authUser.id)
      if (authDelErr) {
        console.error(`  ✗ ${email} — delete auth.users failed:`, authDelErr.message)
        continue
      }
      console.log(`  ✓ ${email} — supprimé de auth.users (${authUser.id})`)
    }

    console.log()
  }
}

/**
 * Pas d'API directe `getUserByEmail` côté admin — on liste page par page
 * jusqu'à trouver. Pour ~100 invités, une seule page (perPage=200) suffit.
 */
async function findAuthUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<{ id: string } | null> {
  let page = 1
  while (page < 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      console.error('  ✗ listUsers failed:', error.message)
      return null
    }
    const found = data.users.find((u) => u.email?.toLowerCase() === email)
    if (found) return { id: found.id }
    if (data.users.length < 200) return null
    page += 1
  }
  return null
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
