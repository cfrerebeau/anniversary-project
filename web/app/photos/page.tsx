import { requireGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { BAEyebrow } from '@/components/design/eyebrow'
import { PhotosUploader } from '@/components/photos/uploader'
import { PhotoCard } from '@/components/photos/photo-card'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL = 60 * 30 // 30 min

type PhotoRow = {
  id: string
  storage_bucket: string
  storage_path: string
  caption: string | null
  content_type: string | null
  created_at: string
}

export default async function PhotosPage() {
  const guest = await requireGuest()
  const service = getServiceClient()

  const { data: photosRaw, error: photosErr } = await service
    .from('photos')
    .select('id, storage_bucket, storage_path, caption, content_type, created_at')
    .eq('guest_id', guest.id)
    .order('created_at', { ascending: false })

  if (photosErr) {
    console.error('[photos/page:query]', photosErr, { guestId: guest.id })
  }
  const photos = (photosRaw ?? []) as PhotoRow[]

  // Batch sign URLs par bucket (même pattern que /admin/photos).
  const byBucket = new Map<string, PhotoRow[]>()
  for (const p of photos) {
    const arr = byBucket.get(p.storage_bucket) ?? []
    arr.push(p)
    byBucket.set(p.storage_bucket, arr)
  }
  const signedUrls = new Map<string, string>()
  for (const [bucket, items] of byBucket) {
    const { data, error: signErr } = await service.storage
      .from(bucket)
      .createSignedUrls(
        items.map((it) => it.storage_path),
        SIGNED_URL_TTL,
      )
    if (signErr) {
      console.error('[photos/page:sign-urls]', signErr, { bucket })
    }
    for (const row of data ?? []) {
      if (row.signedUrl && row.path) {
        signedUrls.set(`${bucket}/${row.path}`, row.signedUrl)
      }
    }
  }

  return (
    <PageContainer width="normal">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/" />
        <BAPageTitle
          eyebrow="02 · photos souvenirs"
          title="Tes vieilles photos d'eux."
          italicWord="vieilles"
          sub="Voyages, dîners, déguisements, mariages d'amis. Plus c'est vieux ou flou, mieux c'est. Promis, ça reste entre nous — jamais affiché publiquement."
        />
        <PhotosUploader />

        {photos.length > 0 && (
          <div className="px-[22px] pt-[20px]">
            <div className="flex items-center justify-between mb-[12px]">
              <BAEyebrow>Tes photos</BAEyebrow>
              <div className="text-[12px] text-ink-mute">
                {photos.length} photo{photos.length > 1 ? 's' : ''}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">
              {photos.map((p) => (
                <PhotoCard
                  key={p.id}
                  id={p.id}
                  url={signedUrls.get(`${p.storage_bucket}/${p.storage_path}`) ?? null}
                  caption={p.caption ?? ''}
                  contentType={p.content_type}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
