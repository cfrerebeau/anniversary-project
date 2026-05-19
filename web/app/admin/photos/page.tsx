import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { BACard } from '@/components/design/card'
import { PhotosDiaporama } from '@/components/admin/photos-diaporama'
import type { PhotoLite } from '@/components/admin/photos-diaporama.helpers'
import { nowMs } from '@/lib/format'

export const dynamic = 'force-dynamic'

type PhotoRow = {
  id: string
  storage_bucket: string
  storage_path: string
  uploader_name: string | null
  caption: string | null
  content_type: string | null
  created_at: string
  guests: { email: string; full_name: string | null } | null
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const SIGNED_URL_TTL = 60 * 30 // 30 min

export default async function AdminPhotosPage() {
  await requireAdmin()
  const service = getServiceClient()

  const { data: photosRaw } = await service
    .from('photos')
    .select(
      'id, storage_bucket, storage_path, uploader_name, caption, content_type, created_at, guests(email, full_name)',
    )
    .order('created_at', { ascending: false })

  const photos = (photosRaw ?? []) as unknown as PhotoRow[]

  // Batch sign URLs per bucket. En pratique tout vit dans `photos-souvenirs`,
  // mais on regroupe par bucket au cas où ça change.
  const byBucket = new Map<string, PhotoRow[]>()
  for (const p of photos) {
    const arr = byBucket.get(p.storage_bucket) ?? []
    arr.push(p)
    byBucket.set(p.storage_bucket, arr)
  }
  const signedUrls = new Map<string, string>()
  for (const [bucket, items] of byBucket) {
    const { data } = await service.storage
      .from(bucket)
      .createSignedUrls(
        items.map((it) => it.storage_path),
        SIGNED_URL_TTL,
      )
    for (const row of data ?? []) {
      if (row.signedUrl && row.path) {
        signedUrls.set(`${bucket}/${row.path}`, row.signedUrl)
      }
    }
  }

  const urlIssuedAt = nowMs()
  const photosLite: PhotoLite[] = photos
    .map((p) => {
      const url = signedUrls.get(`${p.storage_bucket}/${p.storage_path}`)
      if (!url) return null
      return {
        id: p.id,
        url,
        urlIssuedAt,
        caption: p.caption,
        contentType: p.content_type,
        uploaderName: p.uploader_name,
      }
    })
    .filter((p): p is PhotoLite => p !== null)

  return (
    <PageContainer width="wide">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/admin" label="admin" />
        <BAPageTitle
          eyebrow="admin · photos"
          title="Tout ce qui a été partagé."
          italicWord="partagé"
          sub={`${photos.length} fichier${photos.length > 1 ? 's' : ''} dans le bucket privé. URLs signées valables ${Math.round(SIGNED_URL_TTL / 60)} min.`}
        />

        <PhotosDiaporama photos={photosLite} />

        <div className="px-[22px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">
          {photos.map((p) => {
            const url = signedUrls.get(`${p.storage_bucket}/${p.storage_path}`)
            const isVideo = p.content_type?.startsWith('video/')
            return (
              <BACard key={p.id} className="overflow-hidden p-0">
                <div
                  className="relative w-full bg-paper-deep"
                  style={{ aspectRatio: '4 / 3' }}
                >
                  {url ? (
                    isVideo ? (
                      <video
                        src={url}
                        controls
                        preload="metadata"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={p.caption ?? ''}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    )
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-ink-mute text-[12px]">
                      URL signée indisponible
                    </div>
                  )}
                </div>
                <div className="p-[14px]">
                  {p.caption && (
                    <div className="text-[14px] leading-[1.4] mb-[6px]">{p.caption}</div>
                  )}
                  <div className="text-[12px] text-ink-soft">
                    {p.uploader_name ?? p.guests?.full_name ?? '—'}
                    {p.guests?.email && (
                      <span className="text-ink-mute"> · {p.guests.email}</span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-ink-mute tracking-[0.1em] uppercase mt-[4px]">
                    {dateFmt.format(new Date(p.created_at))}
                  </div>
                </div>
              </BACard>
            )
          })}
          {photos.length === 0 && (
            <div className="col-span-full text-center text-ink-mute py-[40px]">
              Aucune photo partagée pour l&apos;instant.
            </div>
          )}
        </div>

        <div className="h-[40px]" />
      </div>
    </PageContainer>
  )
}
