import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { getServerClient } from '@/lib/supabase/server'

/**
 * Route appelée par le clic sur le lien magique. Deux modes supportés :
 *
 *   1. `?token_hash=...&type=magiclink` (notre flow par défaut) — vérifie le
 *      token côté serveur via `verifyOtp` et pose le cookie de session.
 *   2. `?code=...` (PKCE, fallback) — échange le code contre une session.
 *
 * Le legacy flow Supabase (`/auth/v1/verify` → fragment `#access_token=...`)
 * n'est pas supporté car le fragment n'est jamais envoyé au serveur.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const next = url.searchParams.get('next') ?? '/'
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const code = url.searchParams.get('code')

  const supabase = await getServerClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin))
    }
    console.error('[auth/callback] verifyOtp failed', error)
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin))
    }
    console.error('[auth/callback] exchangeCodeForSession failed', error)
  } else {
    console.error('[auth/callback] missing token_hash/type and code')
  }

  return NextResponse.redirect(new URL('/access', url.origin))
}
