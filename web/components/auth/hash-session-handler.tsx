'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'

/**
 * Quand un invité clique sur un magic link généré par `auth.admin.generateLink`,
 * Supabase fait un 303 vers `https://<base>/#access_token=…&refresh_token=…&type=magiclink`
 * (flow "implicit", car admin.generateLink n'a pas de PKCE challenge côté client).
 *
 * Le hash fragment n'arrive pas au serveur. Ce composant client lit la valeur,
 * appelle `setSession` côté navigateur (ce qui pose les cookies SSR via
 * @supabase/ssr), nettoie l'URL puis recharge le RSC.
 */
export function HashSessionHandler() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash || !hash.includes('access_token=')) return

    const params = new URLSearchParams(hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (!access_token || !refresh_token) return

    const supabase = getBrowserClient()
    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setError(error.message)
          return
        }
        // Strip le hash et redirige vers la home (où requireGuest validera)
        window.history.replaceState(null, '', window.location.pathname)
        router.replace('/')
        router.refresh()
      })
      .catch((err) => setError(String(err)))
  }, [router])

  if (!error) return null
  return (
    <div className="ba-fade mt-[18px] text-[13px] text-stamp-deep">
      Lien expiré ou invalide ({error}). Demande un nouveau lien ci-dessous.
    </div>
  )
}
