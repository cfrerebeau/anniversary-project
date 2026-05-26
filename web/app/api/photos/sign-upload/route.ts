import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { photoSignSchema } from '@/lib/validators'
import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { getClientIPHash } from '@/lib/ip'
import { checkRateLimit } from '@/lib/rate-limit'
import { PHOTO_BUCKETS } from '@/lib/photo-buckets'
import { issueUploadNonce } from '@/lib/upload-nonce'

export async function POST(request: NextRequest) {
  const guest = await getCurrentGuest()
  if (!guest) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let ipHash = 'unknown'
  try {
    ipHash = await getClientIPHash()
  } catch {}

  const rl = await checkRateLimit(`photos:${ipHash}`, 1000, 3600)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const json = await request.json().catch(() => null)
  const parsed = photoSignSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { filename, content_type, size_bytes, bucket } = parsed.data
  const bucketConf = PHOTO_BUCKETS[bucket]

  if (size_bytes > bucketConf.maxBytes) {
    return NextResponse.json(
      { error: 'too_large', max_bytes: bucketConf.maxBytes },
      { status: 413 },
    )
  }

  // Path: {guest_id}/{ts}-{randomHex8}-{safe-filename}
  // Le random hex évite les collisions sur batch upload (plusieurs fichiers
  // signés dans la même ms avec le même filename — XHR concurrents).
  const safeName = filename
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .slice(0, 80)
  const rand = randomBytes(4).toString('hex')
  const storagePath = `${guest.id}/${Date.now()}-${rand}-${safeName}`

  const service = getServiceClient()
  const { data, error } = await service.storage
    .from(bucketConf.id)
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    console.error('[sign-upload]', error)
    return NextResponse.json({ error: 'sign_failed' }, { status: 500 })
  }

  // HMAC nonce qui binde (guest, bucket, path) — vérifié dans /process pour
  // empêcher un client de signer dans le bucket A et déclarer le bucket B.
  const { nonce, exp } = issueUploadNonce({
    guestId: guest.id,
    bucket,
    path: storagePath,
  })

  return NextResponse.json({
    bucket,
    bucket_id: bucketConf.id,
    path: storagePath,
    signed_url: data.signedUrl,
    token: data.token,
    content_type,
    upload_nonce: nonce,
    upload_nonce_exp: exp,
  })
}
