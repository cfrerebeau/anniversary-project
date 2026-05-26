import { NextResponse, type NextRequest } from 'next/server'
import sharp from 'sharp'
import { photoProcessSchema } from '@/lib/validators'
import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { getClientIPHash } from '@/lib/ip'
import { PHOTO_BUCKETS } from '@/lib/photo-buckets'
import { verifyUploadNonce } from '@/lib/upload-nonce'

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
  const {
    storage_path: originalPath,
    caption,
    content_type,
    size_bytes: clientSize,
    bucket,
    upload_nonce,
    upload_nonce_exp,
  } = parsed.data

  // Verify HMAC nonce — empêche le client de falsifier (bucket, path).
  const nonceOk = verifyUploadNonce(
    { guestId: guest.id, bucket, path: originalPath },
    upload_nonce,
    upload_nonce_exp,
  )
  if (!nonceOk) {
    return NextResponse.json({ error: 'nonce_invalid' }, { status: 403 })
  }

  // Sanity check : le path doit commencer par le guest_id (sign-upload garantit
  // ce préfixe, mais on revérifie au cas où le HMAC serait re-utilisé hors-flow).
  if (!originalPath.startsWith(`${guest.id}/`)) {
    return NextResponse.json({ error: 'path_mismatch' }, { status: 403 })
  }

  const bucketConf = PHOTO_BUCKETS[bucket]
  const service = getServiceClient()

  // Verify object exists in the claimed bucket. `.list(prefix)` n'a pas de
  // mode exact-match : `search` est un préfixe substring. On filtre côté
  // serveur et on cherche l'exact match. `limit` est large pour absorber
  // un dossier guest avec beaucoup de fichiers.
  const dir = originalPath.substring(0, originalPath.lastIndexOf('/'))
  const base = originalPath.substring(originalPath.lastIndexOf('/') + 1)
  const { data: listed, error: listErr } = await service.storage
    .from(bucketConf.id)
    .list(dir, { search: base, limit: 200 })
  if (listErr) {
    console.error('[photos/process:list]', listErr)
    return NextResponse.json({ error: 'storage_failed' }, { status: 500 })
  }
  const objMeta = listed?.find((it) => it.name === base)
  if (!objMeta) {
    return NextResponse.json({ error: 'object_missing' }, { status: 404 })
  }

  // Taille réelle depuis Supabase. Si metadata.size manque (rare mais possible),
  // on retombe sur le size client-déclaré (déjà validé par photoSignSchema) —
  // jamais 0, sinon les budgets ZIP en aval seraient bypassables.
  const reportedSize =
    typeof objMeta.metadata?.size === 'number' ? objMeta.metadata.size : null
  if (reportedSize != null && reportedSize > bucketConf.maxBytes) {
    // Cleanup et 413 — l'utilisateur a réussi à pousser plus que le cap.
    await service.storage.from(bucketConf.id).remove([originalPath])
    return NextResponse.json({ error: 'too_large' }, { status: 413 })
  }

  let finalPath = originalPath
  let finalSize = reportedSize ?? clientSize
  let finalContentType = content_type

  if (content_type.startsWith('image/')) {
    // Download original
    const { data: blob, error: dlErr } = await service.storage
      .from(bucketConf.id)
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

      const optimizedPath = originalPath
        .replace(/^/, 'optimized/')
        .replace(/\.[^.]+$/, '.jpg')
      const { error: upErr } = await service.storage
        .from(bucketConf.id)
        .upload(optimizedPath, optimized, {
          contentType: 'image/jpeg',
          upsert: true,
        })
      if (upErr) {
        console.error('[photos/process:upload]', upErr)
        return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
      }

      // Cleanup original
      await service.storage.from(bucketConf.id).remove([originalPath])
      finalPath = optimizedPath
      finalSize = optimized.byteLength
      finalContentType = 'image/jpeg'
    } catch (err) {
      // Si sharp échoue (HEIC sans codec, fichier corrompu, etc.), on garde
      // l'original tel quel.
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
      storage_bucket: bucketConf.id,
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
    // 23505 = unique_violation : replay du même nonce dans son TTL après
    // qu'une 1ère row a déjà été créée. Renvoyer la row existante plutôt
    // qu'une 5xx pour rester idempotent côté client.
    if ((dbErr as { code?: string }).code === '23505') {
      const { data: existing } = await service
        .from('photos')
        .select('id, storage_path')
        .eq('storage_bucket', bucketConf.id)
        .eq('storage_path', finalPath)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({
          ok: true,
          id: existing.id,
          storage_path: existing.storage_path,
          replay: true,
        })
      }
    }
    console.error('[photos/process:db]', dbErr)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: row.id, storage_path: row.storage_path })
}
