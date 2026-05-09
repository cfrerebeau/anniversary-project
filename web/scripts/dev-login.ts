#!/usr/bin/env tsx
/**
 * Usage : pnpm dev-login <email>
 *
 * Génère un magic-link pour <email> et l'affiche en console — n'envoie
 * AUCUN email. Si l'email n'est pas dans `guests`, il y est ajouté
 * (is_blocked=false) avant la génération du lien.
 *
 * À utiliser en local uniquement : nécessite SUPABASE_SERVICE_ROLE_KEY.
 */
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: '.env.local' })

function required(key: string): string {
  const v = process.env[key]
  if (!v) {
    console.error(`Missing env var: ${key}`)
    process.exit(1)
  }
  return v
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    console.error('Usage: pnpm dev-login <email>')
    process.exit(1)
  }

  const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL')
  const SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY')
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: existing } = await supabase
    .from('guests')
    .select('id, is_blocked')
    .eq('email', email)
    .maybeSingle()

  if (existing?.is_blocked) {
    console.error(`✗ ${email} is blocked (is_blocked=true). Refusing.`)
    process.exit(1)
  }

  if (!existing) {
    const { error } = await supabase
      .from('guests')
      .insert({ email, full_name: email.split('@')[0], is_blocked: false })
    if (error) {
      console.error(`✗ insert into guests failed:`, error.message)
      process.exit(1)
    }
    console.log(`+ added ${email} to guests`)
  }

  const { data: link, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${BASE_URL}/auth/callback` },
  })
  if (error || !link?.properties?.action_link) {
    console.error('✗ generateLink failed:', error?.message)
    process.exit(1)
  }

  console.log('\nPaste in browser:')
  console.log(link.properties.action_link)
  console.log()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
