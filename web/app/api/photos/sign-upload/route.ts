import { NextResponse, type NextRequest } from 'next/server'
import { photoSignSchema } from '@/lib/validators'
import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { getClientIPHash } from '@/lib/ip'
import { checkRateLimit } from '@/lib/rate-limit'

const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET ?? 'photos-souvenirs'

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
  const { filename, content_type } = parsed.data

  // Path: {guest_id}/{timestamp}-{safe-filename}
  const safeName = filename
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .slice(0, 80)
  const storagePath = `${guest.id}/${Date.now()}-${safeName}`

  const service = getServiceClient()
  const { data, error } = await service.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    console.error('[sign-upload]', error)
    return NextResponse.json({ error: 'sign_failed' }, { status: 500 })
  }

  return NextResponse.json({
    bucket: BUCKET,
    path: storagePath,
    signed_url: data.signedUrl,
    token: data.token,
    content_type,
  })
}
