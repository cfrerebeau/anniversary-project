import { redirect } from 'next/navigation'
import { getServiceClient } from '@/lib/supabase/server'
import { getCagnotteTotalCents } from '@/lib/cagnotte'
import { nowMs } from '@/lib/format'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { BeneficiaryTotalCard } from '@/components/cadeau/beneficiary-total-card'
import { InviteShareCard } from '@/components/cadeau/invite-share-card'
import { CadeauTabs } from '@/components/cadeau/cadeau-tabs'
import { MessagesPanel } from '@/components/cadeau/messages-panel'
import { PhotosPanel, type CadeauPhoto } from '@/components/cadeau/photos-panel'
import { getInviteExpiresAtISO } from '@/lib/invite'
import { inspectCadeauAccess } from '@/lib/cadeau-auth'
import { bucketKeyFromStorageId } from '@/lib/photo-buckets'
import { makeIndividualFilename } from '@/lib/zip-photos'
import { parseCadeauTab, type CadeauTabKey } from '@/lib/cadeau-tab'

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

function parseToken(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) return undefined
  return raw
}

export default async function CadeauPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string | string[]
    tab?: string | string[]
  }>
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

  const initialTab: CadeauTabKey = parseCadeauTab(sp.tab)
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

  // Batch-sign URLs par bucket — un seul appel par bucket. Le downloadUrl est
  // dérivé en append `&download=<filename>` côté serveur (Supabase Storage
  // lit ce query param et pose Content-Disposition à la requête GET).
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
      .createSignedUrls(items.map((it) => it.storage_path), SIGNED_URL_TTL)
    if (signErr) {
      console.error('[cadeau/page:sign]', signErr, { bucket })
    }
    for (const row of data ?? []) {
      if (row.signedUrl && row.path) {
        signedUrls.set(`${bucket}/${row.path}`, row.signedUrl)
      }
    }
  }

  const issuedAt = nowMs()
  const enrichedPhotos: CadeauPhoto[] = photos.map((p) => {
    const url = signedUrls.get(`${p.storage_bucket}/${p.storage_path}`) ?? null
    const filename = makeIndividualFilename(p)
    // Construit l'URL de download via le constructeur natif pour gérer
    // proprement la présence d'un `?` existant (Supabase signed URLs en ont
    // toujours un, mais on évite la brittleness). Le param `download` est
    // lu par Supabase Storage côté GET, indépendamment du payload signé.
    let downloadUrl: string | null = null
    if (url) {
      try {
        const u = new URL(url)
        u.searchParams.set('download', filename)
        downloadUrl = u.toString()
      } catch {
        downloadUrl = null
      }
    }
    return {
      ...p,
      url,
      downloadUrl,
      downloadFilename: filename,
      urlIssuedAt: issuedAt,
    }
  })

  // Split par bucket via le mapping clé publique → id Supabase.
  const souvenirsPhotos: CadeauPhoto[] = []
  const eventPhotos: CadeauPhoto[] = []
  for (const p of enrichedPhotos) {
    const key = bucketKeyFromStorageId(p.storage_bucket)
    if (key === 'souvenirs') souvenirsPhotos.push(p)
    else if (key === 'event') eventPhotos.push(p)
  }

  const backHref = auth.kind === 'admin' ? '/admin' : '/'

  const inviteSlug = process.env.GLOBAL_INVITE_SLUG ?? ''
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ''
  const inviteUrl = inviteSlug && baseUrl ? `${baseUrl}/invite/${inviteSlug}` : null
  const inviteExpiresAt = getInviteExpiresAtISO()

  return (
    <PageContainer width="wide">
      <div className="min-h-screen pt-[54px]">
        <BAHeader
          backHref={backHref}
          label={auth.kind === 'admin' ? 'admin' : 'accueil'}
          hideBrand
        />
        <BAPageTitle
          eyebrow="cadeau · brice & alix"
          title="Tout ce qu'on a préparé pour vous."
          italicWord="préparé"
          sub={
            <p className="text-ink text-[17px] leading-[1.45] font-medium">
              Merci encore pour ce super week-end. Voici la cagnotte, les photos et les mots.
              On continue d&apos;en récupérer.
            </p>
          }
        />

        {/* Hero — toujours visible au-dessus des onglets */}
        <div className="px-[22px]">
          <BeneficiaryTotalCard totalCents={total} />
        </div>

        {inviteUrl && (
          <div className="px-[22px] pt-[18px]">
            <InviteShareCard inviteUrl={inviteUrl} expiresAtISO={inviteExpiresAt} />
          </div>
        )}

        <div className="pt-[32px]">
          <CadeauTabs
            initialTab={initialTab}
            counts={{
              mots: messages.length,
              avant: souvenirsPhotos.length,
              fete: eventPhotos.length,
            }}
            panels={{
              mots: <MessagesPanel messages={messages} />,
              avant: (
                <PhotosPanel photos={souvenirsPhotos} bucketKey="souvenirs" />
              ),
              fete: <PhotosPanel photos={eventPhotos} bucketKey="event" />,
            }}
          />
        </div>

        <div className="h-[60px]" />
      </div>
    </PageContainer>
  )
}
