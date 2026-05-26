import { getServiceClient } from '@/lib/supabase/server'
import { getCagnotteTotalCents } from '@/lib/cagnotte'
import { nowMs } from '@/lib/format'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { BACard } from '@/components/design/card'
import { BAEyebrow } from '@/components/design/eyebrow'
import { BeneficiaryTotalCard } from '@/components/cadeau/beneficiary-total-card'
import { DownloadZipButton } from '@/components/cadeau/download-zip-button'
import { InviteShareCard } from '@/components/cadeau/invite-share-card'
import { getInviteExpiresAtISO } from '@/lib/invite'
import { PhotosDiaporama } from '@/components/admin/photos-diaporama'
import type { PhotoLite } from '@/components/admin/photos-diaporama.helpers'
import { redirect } from 'next/navigation'
import { inspectCadeauAccess } from '@/lib/cadeau-auth'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL = 60 * 30 // 30 min

type MessageRow = {
  id: string
  display_name: string | null
  message: string | null
  created_at: string
}

type PhotoRow = {
  id: string
  storage_bucket: string
  storage_path: string
  caption: string | null
  content_type: string | null
  uploader_name: string | null
  size_bytes: number | null
  created_at: string
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function parseToken(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) {
    // Pollution multi-tokens — refuse plutôt que de prendre le premier.
    return undefined
  }
  return raw
}

export default async function CadeauPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const sp = await searchParams
  const token = parseToken(sp.token)

  // Next 16 : un Server Component ne peut pas mettre de cookie. On délègue
  // l'échange token → cookie à un route handler dédié.
  if (token != null) {
    redirect(`/api/cadeau/exchange?token=${encodeURIComponent(token)}`)
  }

  // En mode 'page', inspectCadeauAccess fait redirect('/') sur deny ;
  // ce qui revient ici ne peut être que { kind: 'admin' | 'cookie' }.
  const auth = (await inspectCadeauAccess(undefined, 'page')) as {
    kind: 'admin' | 'cookie'
  }

  const service = getServiceClient()

  const [total, messagesRes, photosRes] = await Promise.all([
    getCagnotteTotalCents(),
    service
      .from('cagnotte_messages')
      .select('id, display_name, message, created_at')
      .not('message', 'is', null)
      .neq('message', '')
      .order('created_at', { ascending: false }),
    service
      .from('photos')
      .select(
        'id, storage_bucket, storage_path, caption, content_type, uploader_name, size_bytes, created_at',
      )
      .order('created_at', { ascending: true }),
  ])

  if (messagesRes.error) console.error('[cadeau:messages]', messagesRes.error)
  if (photosRes.error) console.error('[cadeau:photos]', photosRes.error)

  const messages = (messagesRes.data ?? []) as MessageRow[]
  const photos = (photosRes.data ?? []) as PhotoRow[]

  // Batch-sign URLs pour le rendu de la galerie + diaporama. Les ZIP signent
  // par-row (TTL court) côté route.
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
      .createSignedUrls(items.map((it) => it.storage_path), SIGNED_URL_TTL)
    for (const row of data ?? []) {
      if (row.signedUrl && row.path) {
        signedUrls.set(`${bucket}/${row.path}`, row.signedUrl)
      }
    }
  }

  const issuedAt = nowMs()
  const photosLite: PhotoLite[] = photos
    .map((p): PhotoLite | null => {
      const url = signedUrls.get(`${p.storage_bucket}/${p.storage_path}`)
      if (!url) return null
      return {
        id: p.id,
        url,
        urlIssuedAt: issuedAt,
        caption: p.caption,
        contentType: p.content_type,
        uploaderName: p.uploader_name,
      }
    })
    .filter((p): p is PhotoLite => p !== null)

  const totalBytes = photos.reduce(
    (acc, p) => acc + (typeof p.size_bytes === 'number' ? p.size_bytes : 0),
    0,
  )

  const backHref = auth.kind === 'admin' ? '/admin' : '/'

  const inviteSlug = process.env.GLOBAL_INVITE_SLUG ?? ''
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ''
  const inviteUrl = inviteSlug && baseUrl ? `${baseUrl}/invite/${inviteSlug}` : null
  const inviteExpiresAt = getInviteExpiresAtISO()

  return (
    <PageContainer width="wide">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref={backHref} label={auth.kind === 'admin' ? 'admin' : 'accueil'} />
        <BAPageTitle
          eyebrow="cadeau · brice & alix"
          title="Tout ce qu'on a préparé pour vous."
          italicWord="préparé"
          sub={
            <p className="text-ink text-[17px] leading-[1.45] font-medium">
              Voici la cagnotte, les mots laissés par tes complices et l&apos;album souvenirs.
              À vous deux.
            </p>
          }
        />

        {/* Total */}
        <div className="px-[22px]">
          <BeneficiaryTotalCard totalCents={total} />
        </div>

        {/* Invitation */}
        {inviteUrl && (
          <div className="px-[22px] pt-[18px]">
            <InviteShareCard inviteUrl={inviteUrl} expiresAtISO={inviteExpiresAt} />
          </div>
        )}

        {/* Messages */}
        <div className="px-[22px] pt-[28px]">
          <BAEyebrow color="olive">Les mots</BAEyebrow>
          <div className="mt-[10px] flex flex-col gap-[14px]">
            {messages.map((m) => (
              <BACard key={m.id} className="p-[20px]">
                <div className="font-serif text-[20px] leading-[1.15]">
                  {m.display_name ?? '—'}
                </div>
                {m.message && (
                  <div className="mt-[10px] text-[14px] leading-[1.5] whitespace-pre-wrap">
                    {m.message}
                  </div>
                )}
                <div className="mt-[12px] pt-[10px] border-t border-paper-edge font-mono text-[10px] tracking-[0.1em] uppercase text-ink-mute">
                  {dateFmt.format(new Date(m.created_at))}
                </div>
              </BACard>
            ))}
            {messages.length === 0 && (
              <div className="text-center text-ink-mute py-[20px]">
                Pas encore de mot.
              </div>
            )}
          </div>
        </div>

        {/* Galerie */}
        <div className="px-[22px] pt-[32px] flex items-center justify-between flex-wrap gap-[10px]">
          <BAEyebrow color="olive">L&apos;album</BAEyebrow>
          <DownloadZipButton
            href="/api/cadeau/download-all"
            filename="cadeau-brice-alix.zip"
            count={photosLite.length}
            totalBytes={totalBytes}
          />
        </div>

        <div className="px-[22px] pt-[14px]">
          <PhotosDiaporama
            photos={photosLite}
            storageKey="diaporama-cadeau-all"
            refreshEndpoint="/api/cadeau/photos/sign"
          />
        </div>

        {photosLite.length > 0 ? (
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
                  {p.caption && (
                    <div className="p-[14px] text-[14px] leading-[1.4]">{p.caption}</div>
                  )}
                </BACard>
              )
            })}
          </div>
        ) : (
          <div className="px-[22px] py-[20px] text-center text-ink-mute">
            Pas encore de photo.
          </div>
        )}

        <div className="h-[60px]" />
      </div>
    </PageContainer>
  )
}
