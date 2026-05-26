'use client'

import { useCallback, useMemo, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BACard } from '@/components/design/card'
import { BAEyebrow } from '@/components/design/eyebrow'
import { PhotosUploader } from '@/components/photos/uploader'
import { PhotoCard } from '@/components/photos/photo-card'
import { PhotosDiaporama } from '@/components/admin/photos-diaporama'
import type { PhotoLite } from '@/components/admin/photos-diaporama.helpers'

export type PhotosTabKey = 'souvenirs' | 'event'

export type PhotoRow = {
  id: string
  guest_id: string | null
  storage_bucket: string
  storage_path: string
  caption: string | null
  content_type: string | null
  uploader_name: string | null
  size_bytes: number | null
  created_at: string
  // signed URL (résolu côté serveur)
  url: string | null
  urlIssuedAt: number
}

type Props = {
  initialTab: PhotosTabKey
  souvenirs: PhotoRow[]
  event: PhotoRow[]
  currentGuestId: string
}

const TAB_LABEL: Record<PhotosTabKey, string> = {
  souvenirs: 'Vieilles photos',
  event: 'Photos de la fête',
}

const DIAPORAMA_STORAGE_KEY: Record<PhotosTabKey, string> = {
  souvenirs: 'diaporama-photos-souvenirs',
  event: 'diaporama-photos-event',
}

const ZIP_FILENAME: Record<PhotosTabKey, string> = {
  souvenirs: 'vieilles-photos.zip',
  event: 'photos-de-la-fete.zip',
}

const LARGE_ZIP_BYTES = 1.5 * 1024 ** 3 // 1.5 GB — avertissement "ça prend du temps"
const ZIP_BUDGET_BYTES = 5 * 1024 ** 3 // doit matcher MAX_BYTES dans /api/photos/download-all/route.ts

export function PhotosTabs({ initialTab, souvenirs, event, currentGuestId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  // Source de vérité : l'URL. Pas de useState — sinon il faut un useEffect
  // pour réconcilier sur Back/Forward, ce qui retombe dans le piège
  // set-state-in-effect. `initialTab` n'est utilisé que comme fallback côté
  // serveur quand searchParams n'est pas encore résolu.
  const fromUrl = searchParams.get('tab')
  const tab: PhotosTabKey =
    fromUrl === 'event' ? 'event' : fromUrl === 'souvenirs' ? 'souvenirs' : initialTab

  const switchTab = useCallback(
    (next: PhotosTabKey) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', next)
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [pathname, router, searchParams],
  )

  const rows = tab === 'souvenirs' ? souvenirs : event
  const totalBytes = useMemo(
    () => rows.reduce((acc, r) => acc + (r.size_bytes ?? 0), 0),
    [rows],
  )

  const photosLite: PhotoLite[] = useMemo(
    () =>
      rows
        .filter((r) => r.url)
        .map((r) => ({
          id: r.id,
          url: r.url as string,
          urlIssuedAt: r.urlIssuedAt,
          caption: r.caption,
          contentType: r.content_type,
          uploaderName: r.uploader_name,
        })),
    [rows],
  )

  return (
    <>
      {/* Pas de role=tablist : l'implémentation ne respecte pas le W3C tab
          pattern (flèches gauche/droite, role=tabpanel). On garde de simples
          boutons — un screen reader les annonce comme tels. `aria-pressed`
          communique l'état actif sans promettre un comportement clavier de tab. */}
      <div className="px-[22px] pt-[6px] flex gap-[8px]" aria-label="Galerie photos">
        {(['souvenirs', 'event'] as const).map((key) => {
          const active = tab === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => switchTab(key)}
              className={`ba-btn rounded-[12px] px-[14px] py-[8px] text-[13px] font-medium ${
                active
                  ? 'bg-ink text-paper'
                  : 'bg-transparent text-ink-soft border border-paper-edge hover:text-ink'
              }`}
            >
              {TAB_LABEL[key]}
              <span className={`ml-[6px] text-[11px] ${active ? 'text-paper/70' : 'text-ink-mute'}`}>
                {key === 'souvenirs' ? souvenirs.length : event.length}
              </span>
            </button>
          )
        })}
      </div>

      <div className="px-[22px] pt-[16px]">
        <PhotosUploader bucket={tab} />
      </div>

      <div className="px-[22px] pt-[10px] flex flex-wrap gap-[10px] items-center">
        <PhotosDiaporama
          photos={photosLite}
          storageKey={DIAPORAMA_STORAGE_KEY[tab]}
          refreshEndpoint="/api/photos/sign"
        />
        <DownloadZipButton bucket={tab} count={rows.length} totalBytes={totalBytes} />
      </div>

      {rows.length > 0 ? (
        <div className="px-[22px] pt-[20px]">
          <div className="flex items-center justify-between mb-[12px]">
            <BAEyebrow>Toutes les photos partagées</BAEyebrow>
            <div className="text-[12px] text-ink-mute">
              {rows.length} photo{rows.length > 1 ? 's' : ''}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">
            {rows.map((r) => (
              <PhotoCard
                key={r.id}
                id={r.id}
                url={r.url}
                caption={r.caption ?? ''}
                contentType={r.content_type}
                uploaderName={r.uploader_name}
                isOwner={r.guest_id === currentGuestId}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="px-[22px] pt-[20px]">
          <BACard className="p-[20px] text-center text-ink-mute text-[14px]">
            Pas encore de photo dans cet onglet.
          </BACard>
        </div>
      )}
    </>
  )
}

function DownloadZipButton({
  bucket,
  count,
  totalBytes,
}: {
  bucket: PhotosTabKey
  count: number
  totalBytes: number
}) {
  if (count === 0) {
    return (
      <button
        type="button"
        disabled
        className="ba-btn rounded-[14px] px-[16px] py-[10px] text-[13px] bg-transparent text-ink-mute border border-paper-edge cursor-not-allowed"
      >
        Pas encore de photo
      </button>
    )
  }
  // Au-delà du budget, l'API renverra 413 et le browser téléchargerait un
  // fichier "too_large" au lieu du ZIP — UX cassée. On désactive le bouton.
  if (totalBytes > ZIP_BUDGET_BYTES) {
    return (
      <div className="flex flex-col gap-[4px] items-start">
        <button
          type="button"
          disabled
          className="ba-btn rounded-[14px] px-[16px] py-[10px] text-[13px] bg-transparent text-ink-mute border border-paper-edge cursor-not-allowed"
        >
          Album trop volumineux
        </button>
        <div className="text-[11px] text-ink-mute leading-[1.4]">
          Trop volumineux pour un seul ZIP — contacte les admins.
        </div>
      </div>
    )
  }
  const heavy = totalBytes > LARGE_ZIP_BYTES
  return (
    <div className="flex flex-col gap-[4px]">
      <a
        href={`/api/photos/download-all?bucket=${bucket}`}
        className="ba-btn rounded-[14px] px-[16px] py-[10px] text-[13px] font-semibold bg-ink text-paper inline-flex items-center gap-[8px]"
        style={{
          boxShadow:
            '0 1px 0 rgba(255,255,255,.12) inset, 0 6px 16px -8px rgba(21,35,59,.6)',
        }}
        download={ZIP_FILENAME[bucket]}
      >
        Tout télécharger en ZIP
      </a>
      {heavy && (
        <div className="text-[11px] text-ink-mute leading-[1.4]">
          Ça peut prendre quelques minutes — laisse l&apos;onglet ouvert.
        </div>
      )}
    </div>
  )
}
