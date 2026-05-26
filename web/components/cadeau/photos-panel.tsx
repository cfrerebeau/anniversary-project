'use client'

import { useCallback, useMemo, useRef } from 'react'
import { BAEyebrow } from '@/components/design/eyebrow'
import { PhotosDiaporama } from '@/components/admin/photos-diaporama'
import type { PhotoLite } from '@/components/admin/photos-diaporama.helpers'
import { DownloadZipButton } from '@/components/cadeau/download-zip-button'
import { PhotoTile } from '@/components/cadeau/photo-tile'
import {
  PhotoLightbox,
  type LightboxPhoto,
  type PhotoLightboxHandle,
} from '@/components/cadeau/photo-lightbox'

export type CadeauPhoto = {
  id: string
  storage_bucket: string
  storage_path: string
  caption: string | null
  content_type: string | null
  uploader_name: string | null
  size_bytes: number | null
  created_at: string
  url: string | null
  downloadUrl: string | null
  downloadFilename: string
  urlIssuedAt: number
}

type Props = {
  photos: CadeauPhoto[]
  bucketKey: 'souvenirs' | 'event'
}

const DIAPORAMA_STORAGE_KEY: Record<Props['bucketKey'], string> = {
  souvenirs: 'diaporama-cadeau-souvenirs',
  event: 'diaporama-cadeau-event',
}

const ZIP_FILENAME: Record<Props['bucketKey'], string> = {
  souvenirs: 'cadeau-avant-le-mariage.zip',
  event: 'cadeau-pendant-la-fete.zip',
}

const EMPTY_COPY: Record<Props['bucketKey'], string> = {
  souvenirs: "L'album d'avant est vide.",
  event: 'Personne n\'a encore partagé de photo de la fête.',
}

export function PhotosPanel({ photos, bucketKey }: Props) {
  const lightboxRef = useRef<PhotoLightboxHandle | null>(null)

  const photosLite: PhotoLite[] = useMemo(
    () =>
      photos
        .filter((p): p is CadeauPhoto & { url: string } => p.url != null)
        .map((p) => ({
          id: p.id,
          url: p.url,
          urlIssuedAt: p.urlIssuedAt,
          caption: p.caption,
          contentType: p.content_type,
          uploaderName: p.uploader_name,
        })),
    [photos],
  )

  const lightboxPhotos: LightboxPhoto[] = useMemo(
    () =>
      photos
        .filter(
          (p): p is CadeauPhoto & { url: string; downloadUrl: string } =>
            p.url != null && p.downloadUrl != null,
        )
        .map((p) => ({
          id: p.id,
          url: p.url,
          downloadUrl: p.downloadUrl,
          downloadFilename: p.downloadFilename,
          caption: p.caption,
          contentType: p.content_type,
        })),
    [photos],
  )

  // Map photo.id → index dans lightboxPhotos (la liste filtrée des URLs
   // signées disponibles). Permet d'ouvrir la bonne photo même si certaines
   // sont écartées de la lightbox parce que leur URL signée a échoué.
  const idToLightboxIndex = useMemo(() => {
    const m = new Map<string, number>()
    lightboxPhotos.forEach((p, i) => m.set(p.id, i))
    return m
  }, [lightboxPhotos])

  const openLightbox = useCallback(
    (id: string) => {
      const i = idToLightboxIndex.get(id)
      if (i == null) return
      lightboxRef.current?.open(i)
    },
    [idToLightboxIndex],
  )

  const totalBytes = useMemo(
    () => photos.reduce((acc, p) => acc + (p.size_bytes ?? 0), 0),
    [photos],
  )

  if (photos.length === 0) {
    return (
      <div className="px-[22px] py-[40px] text-center text-ink-mute">
        {EMPTY_COPY[bucketKey]}
      </div>
    )
  }

  return (
    <>
      <div className="px-[22px] flex flex-wrap items-center justify-between gap-[10px] mb-[14px]">
        <BAEyebrow color="olive">
          {photos.length} photo{photos.length > 1 ? 's' : ''}
        </BAEyebrow>
        <div className="flex flex-wrap items-center gap-[10px]">
          <PhotosDiaporama
            photos={photosLite}
            storageKey={DIAPORAMA_STORAGE_KEY[bucketKey]}
            refreshEndpoint="/api/cadeau/photos/sign"
          />
          <DownloadZipButton
            href={`/api/cadeau/download-all?bucket=${bucketKey}`}
            filename={ZIP_FILENAME[bucketKey]}
            count={photos.length}
            totalBytes={totalBytes}
          />
        </div>
      </div>

      <div className="px-[22px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">
        {photos.map((p, idx) => (
          <PhotoTile
            key={p.id}
            id={p.id}
            url={p.url}
            caption={p.caption}
            contentType={p.content_type}
            index={idx}
            total={photos.length}
            onOpen={openLightbox}
          />
        ))}
      </div>

      <PhotoLightbox ref={lightboxRef} photos={lightboxPhotos} />
    </>
  )
}
