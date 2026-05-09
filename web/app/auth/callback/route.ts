import { NextResponse, type NextRequest } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'

/**
 * Route appelée par le clic sur le lien magique. Échange le `?code=...` contre
 * une session, set le cookie, redirige vers la home (ou vers `next` si fourni).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await getServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin))
    }
    console.error('[auth/callback] exchangeCodeForSession failed', error)
  }

  // En cas d'échec : retour sur /access (sans message — surprise oblige).
  return NextResponse.redirect(new URL('/access', url.origin))
}
