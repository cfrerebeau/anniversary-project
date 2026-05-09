import { NextResponse, type NextRequest } from 'next/server'
import sharp from 'sharp'
import { photoProcessSchema } from '@/lib/validators'
import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { getClientIPHash } from '@/lib/ip'

const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET ?? 'photos-souvenirs'
const MAX_DIM = 2000

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const guest = await getCurrentGuest()
  if (!guest) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = photoProcessSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { storage_path: originalPath, caption, content_type, size_bytes } = parsed.data

  const service = getServiceClient()
  let finalPath = originalPath
  let finalSize = size_bytes
  let finalContentType = content_type

  if (content_type.startsWith('image/')) {
    // Download original
    const { data: blob, error: dlErr } = await service.storage
      .from(BUCKET)
      .download(originalPath)
    if (dlErr || !blob) {
      console.error('[photos/process:download]', dlErr)
      return NextResponse.json({ error: 'download_failed' }, { status: 500 })
    }

    try {
      const buffer = Buffer.from(await blob.arrayBuffer())
      const optimized = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer()

      const optimizedPath = originalPath.replace(/^/, 'optimized/').replace(/\.[^.]+$/, '.jpg')
      const { error: upErr } = await service.storage
        .from(BUCKET)
        .upload(optimizedPath, optimized, { contentType: 'image/jpeg', upsert: true })
      if (upErr) {
        console.error('[photos/process:upload]', upErr)
        return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
      }

      // Cleanup original
      await service.storage.from(BUCKET).remove([originalPath])
      finalPath = optimizedPath
      finalSize = optimized.byteLength
      finalContentType = 'image/jpeg'
    } catch (err) {
      // Si sharp échoue (HEIC sans codec, fichier corrompu, etc.), on garde
      // l'original tel quel — la version optimisée sera faite à la curation.
      console.warn('[photos/process:sharp-failed-keep-original]', err)
    }
  }

  let ipHash = 'unknown'
  try {
    ipHash = await getClientIPHash()
  } catch {}

  const { data: row, error: dbErr } = await service
    .from('photos')
    .insert({
      guest_id: guest.id,
      storage_bucket: BUCKET,
      storage_path: finalPath,
      uploader_name: guest.full_name ?? guest.email.split('@')[0],
      caption,
      content_type: finalContentType,
      size_bytes: finalSize,
      ip_hash: ipHash,
    })
    .select('id, storage_path')
    .single()

  if (dbErr) {
    console.error('[photos/process:db]', dbErr)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: row.id, storage_path: row.storage_path })
}
