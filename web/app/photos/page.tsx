import { requireGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { PhotosTabs, type PhotoRow, type PhotosTabKey } from '@/components/photos/photos-tabs'
import { PHOTO_BUCKETS } from '@/lib/photo-buckets'
import { nowMs } from '@/lib/format'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL = 60 * 30 // 30 min — borne identique à /admin/photos

type DbPhoto = {
  id: string
  guest_id: string | null
  storage_bucket: string
  storage_path: string
  caption: string | null
  content_type: string | null
  uploader_name: string | null
  size_bytes: number | null
  created_at: string
}

function parseTab(raw: string | string[] | undefined): PhotosTabKey {
  // Refuse les valeurs multiples (?tab=a&tab=b) plutôt que de prendre la 1ère.
  if (Array.isArray(raw)) return 'souvenirs'
  return raw === 'event' ? 'event' : 'souvenirs'
}

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const guest = await requireGuest()
  const sp = await searchParams
  const initialTab = parseTab(sp.tab)
  const service = getServiceClient()

  // Toutes les photos (souvenirs + event), tous guests confondus. Post-mariage,
  // la galerie est collective. Les mutations restent owner-scoped côté API.
  const { data: rowsRaw, error } = await service
    .from('photos')
    .select(
      'id, guest_id, storage_bucket, storage_path, caption, content_type, uploader_name, size_bytes, created_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[photos/page:query]', error)
  }
  const allPhotos = (rowsRaw ?? []) as DbPhoto[]

  // Batch-sign URLs par bucket.
  const byBucket = new Map<string, DbPhoto[]>()
  for (const p of allPhotos) {
    const arr = byBucket.get(p.storage_bucket) ?? []
    arr.push(p)
    byBucket.set(p.storage_bucket, arr)
  }
  const signedUrls = new Map<string, string>()
  for (const [bucket, items] of byBucket) {
    const { data, error: signErr } = await service.storage
      .from(bucket)
      .createSignedUrls(items.map((it) => it.storage_path), SIGNED_URL_TTL)
    if (signErr) {
      console.error('[photos/page:sign-urls]', signErr, { bucket })
    }
    for (const row of data ?? []) {
      if (row.signedUrl && row.path) {
        signedUrls.set(`${bucket}/${row.path}`, row.signedUrl)
      }
    }
  }

  const issuedAt = nowMs()
  const enriched: PhotoRow[] = allPhotos.map((p) => ({
    ...p,
    url: signedUrls.get(`${p.storage_bucket}/${p.storage_path}`) ?? null,
    urlIssuedAt: issuedAt,
  }))

  const souvenirs = enriched.filter((p) => p.storage_bucket === PHOTO_BUCKETS.souvenirs.id)
  const event = enriched.filter((p) => p.storage_bucket === PHOTO_BUCKETS.event.id)

  return (
    <PageContainer width="normal">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/" />
        <BAPageTitle
          eyebrow="02 · photos"
          title="Toutes les photos."
          italicWord="toutes"
          sub="Les vieilles photos d'avant et les souvenirs de la fête. Tout est partagé entre nous, jamais affiché publiquement."
        />

        <PhotosTabs
          initialTab={initialTab}
          souvenirs={souvenirs}
          event={event}
          currentGuestId={guest.id}
        />

        <div className="h-[40px]" />
      </div>
    </PageContainer>
  )
}
