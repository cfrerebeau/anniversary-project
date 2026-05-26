'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { type CadeauTabKey, CADEAU_TAB_DEFAULT } from '@/lib/cadeau-tab'

const TAB_LABEL: Record<CadeauTabKey, string> = {
  mots: 'Vos mots',
  avant: 'Avant',
  fete: 'La fête',
}

type Props = {
  initialTab: CadeauTabKey
  counts: Record<CadeauTabKey, number>
  panels: Record<CadeauTabKey, ReactNode>
}

/**
 * Switcher d'onglets local — pas de `router.replace` parce que la page
 * /cadeau est `force-dynamic` : un re-render serveur sur chaque clic
 * relancerait toutes les queries Supabase + re-signe toutes les URLs (~1 s
 * sur 200 photos). On garde le tab en `useState`, on met à jour l'URL
 * silencieusement via `history.replaceState` pour le deep-link / partage.
 * Le tab initial vient du serveur (`initialTab` parsé depuis searchParams).
 */
export function CadeauTabs({ initialTab, counts, panels }: Props) {
  const [tab, setTab] = useState<CadeauTabKey>(initialTab ?? CADEAU_TAB_DEFAULT)

  // Synchronise l'URL silencieusement (pas de roundtrip RSC).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const current = url.searchParams.get('tab')
    if (current === tab) return
    url.searchParams.set('tab', tab)
    window.history.replaceState(window.history.state, '', url.toString())
  }, [tab])

  const switchTab = useCallback((next: CadeauTabKey) => {
    setTab(next)
  }, [])

  return (
    <>
      <div
        className="px-[22px] pt-[6px] flex gap-[8px] flex-wrap"
        aria-label="Sections du cadeau"
      >
        {(['mots', 'avant', 'fete'] as const).map((key) => {
          const active = tab === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => switchTab(key)}
              className={`ba-btn rounded-[14px] px-[14px] py-[8px] text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-ink text-paper'
                  : 'bg-transparent text-ink-soft border border-paper-edge hover:text-ink'
              }`}
            >
              {TAB_LABEL[key]}
              <span
                className={`ml-[6px] text-[11px] ${active ? 'text-paper/70' : 'text-ink-mute'}`}
              >
                ·{counts[key]}
              </span>
            </button>
          )
        })}
      </div>

      <div className="pt-[20px]">{panels[tab]}</div>
    </>
  )
}
