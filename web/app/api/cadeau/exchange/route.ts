import { type NextRequest } from 'next/server'
import { applyCookieAndRedirect, inspectCadeauAccess, CadeauDenied } from '@/lib/cadeau-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cookie-exchange endpoint pour la query token `/cadeau?token=…`. Une page
 * Server Component ne peut pas appeler `cookies().set()` dans son render
 * en Next 16 (cookies are read-only from Server Components). La page nous
 * redirige donc ici quand un token est présent ; on valide, on pose le
 * cookie HttpOnly signé, puis on redirect proprement vers /cadeau.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') ?? undefined
  try {
    // 'api' mode pour que les denies remontent en exception plutôt que via
    // `next/navigation` redirect() (qu'on veut maîtriser nous-mêmes ici).
    const result = await inspectCadeauAccess(token, 'api')
    if (result.kind === 'set-cookie-and-redirect') {
      // applyCookieAndRedirect appelle redirect() à l'intérieur, qui dans un
      // route handler Next se transforme en une vraie 307 — on laisse passer.
      await applyCookieAndRedirect(result.redirectTo)
    }
    // Admin ou cookie déjà valide : pas d'échange à faire, on envoie sur la page.
    return Response.redirect(new URL('/cadeau', request.url), 302)
  } catch (err) {
    if (err instanceof CadeauDenied) {
      // Token absent / invalide / rate-limited → renvoie sur la home.
      // Aucun corps ne reflète le token.
      return Response.redirect(new URL('/', request.url), 302)
    }
    throw err
  }
}
