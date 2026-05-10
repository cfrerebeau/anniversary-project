import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createPlainClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Client SSR pour les composants serveur — lit/écrit le cookie session.
 * Utilise la clé anon : OK pour la session utilisateur (auth.users).
 * Pour les écritures privilégiées (insert dans quizz, etc.), utiliser
 * `getServiceClient()` ci-dessous.
 */
export async function getServerClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Setting cookies depuis un Server Component pur peut échouer ; OK si
          // un proxy refresh la session — on ignore.
        }
      },
    },
  })
}

/**
 * Client privilégié avec service_role. À n'utiliser que côté serveur, jamais
 * exposé au bundle client. Pas de session — on agit comme l'app.
 */
let _service: SupabaseClient | null = null
export function getServiceClient(): SupabaseClient {
  if (!_service) {
    _service = createPlainClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _service
}
