import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Toutes les routes sauf : assets statiques, robots, /api/cron/* (pas de
    // session attendue), et les fichiers statiques (images, PDF du RIB).
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)',
  ],
}
