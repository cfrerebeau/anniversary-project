import { PassThrough, Readable } from 'node:stream'
import { once as eventsOnce } from 'node:events'
import archiver from 'archiver'

export type ZipEntryInput = {
  filename: string // pré-sanitizé par le caller
  date: Date
  openStream: (signal: AbortSignal) => Promise<{
    body: ReadableStream<Uint8Array>
    close?: () => void
  }>
}

export type ZipBudget = {
  maxFiles?: number
  maxBytesEstimate?: number
}

export type StreamZipOptions = {
  entries: ZipEntryInput[]
  zipName: string
  budget?: ZipBudget
  totalBytesEstimate?: number
  signal: AbortSignal
}

/**
 * Stream un ZIP en réponse HTTP. Pattern Node→Web :
 *
 *   archiver (Node Readable)
 *     → pipe → PassThrough
 *     → Readable.toWeb → Response body (Web ReadableStream)
 *
 * Append séquentiel avec listener `entry` installé AVANT `archive.append()`
 * pour borner empiriquement la file interne d'archiver à un fichier en transit.
 * `archive.finalize()` est obligatoire — sans ça, la central directory n'est
 * pas écrite et le ZIP est tronqué.
 */
export async function streamZipResponse(opts: StreamZipOptions): Promise<Response> {
  const { entries, zipName, budget, totalBytesEstimate, signal } = opts

  if (budget?.maxFiles && entries.length > budget.maxFiles) {
    return new Response('too_large', { status: 413 })
  }
  if (
    budget?.maxBytesEstimate &&
    totalBytesEstimate != null &&
    totalBytesEstimate > budget.maxBytesEstimate
  ) {
    return new Response('too_large', { status: 413 })
  }
  if (entries.length === 0) {
    return new Response('empty', { status: 404 })
  }

  const archive = archiver('zip', {
    store: true,
    zlib: { level: 0 },
    forceZip64: (totalBytesEstimate ?? 0) > 3.5 * 1024 ** 3,
  })
  const passThrough = new PassThrough()
  archive.pipe(passThrough)

  archive.on('warning', (err) => console.warn('[zip:warning]', err))
  archive.on('error', (err) => {
    console.error('[zip:archive]', err)
    passThrough.destroy(err)
  })

  let appended = 0

  void (async () => {
    try {
      for (const entry of entries) {
        if (signal.aborted) break
        let opened: { body: ReadableStream<Uint8Array>; close?: () => void } | null = null
        try {
          opened = await entry.openStream(signal)
        } catch (err) {
          // Politique "best-effort souvenirs" : on skip et on log.
          console.warn('[zip:open-skip]', {
            filename: entry.filename,
            err: (err as Error).message,
          })
          continue
        }
        // Listener AVANT append : sinon race sur tout petits fichiers (entry
        // peut fire avant qu'on n'attache la promise).
        const entryFinished = eventsOnce(archive, 'entry')
        // Race avec abort + une `error` éventuelle d'archiver pour ne pas
        // rester bloqué si le stream se casse au milieu d'un append.
        const abortPromise = new Promise<never>((_, reject) => {
          if (signal.aborted) {
            reject(new Error('aborted'))
            return
          }
          signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          })
        })
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nodeStream = Readable.fromWeb(opened.body as any)
          archive.append(nodeStream, { name: entry.filename, date: entry.date })
          await Promise.race([entryFinished, abortPromise])
          appended += 1
        } catch (err) {
          console.warn('[zip:entry-failed]', {
            filename: entry.filename,
            err: (err as Error).message,
          })
          // Si abort, on sort tôt — le finally nettoie le stream et la suite
          // de la boucle ne s'exécutera pas (signal.aborted déjà true).
          if (signal.aborted) break
        } finally {
          opened?.close?.()
        }
      }
      // Politique : si rien n'a pu être appendé alors qu'on avait des entries,
      // c'est probablement une panne storage côté serveur — mieux vaut casser
      // le stream et exposer le 5xx que livrer un ZIP vide « réussi ».
      if (appended === 0) {
        archive.abort()
        passThrough.destroy(new Error('all_entries_failed'))
        return
      }
      await archive.finalize()
    } catch (err) {
      console.error('[zip:loop]', err)
      archive.abort()
      passThrough.destroy(err as Error)
    }
  })()

  signal.addEventListener('abort', () => {
    archive.abort()
    passThrough.destroy()
  })

  return new Response(
    Readable.toWeb(passThrough) as unknown as ReadableStream<Uint8Array>,
    {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex',
      },
    },
  )
}

// ── Filenames ────────────────────────────────────────────────────────────────

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

const RESERVED_WIN_NAMES = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i

function extFromMime(ct: string | null | undefined): string | null {
  if (!ct) return null
  return MIME_TO_EXT[ct.toLowerCase()] ?? null
}

function extFromPath(path: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(path)
  return m ? m[1].toLowerCase() : null
}

export function makeUniqueFilename(
  photo: {
    caption: string | null
    storage_path: string
    content_type: string | null
    created_at: string
  },
  idx: number,
  used: Set<string>,
  folderPrefix?: string,
): string {
  const date = new Date(photo.created_at)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')

  let slug = (photo.caption || 'photo')
    .normalize('NFD')
    .replace(/\p{Mn}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  if (!slug) slug = 'photo'
  if (RESERVED_WIN_NAMES.test(slug)) slug = `f-${slug}`

  const ext = extFromMime(photo.content_type) ?? extFromPath(photo.storage_path) ?? 'bin'

  const seq = String(idx + 1).padStart(3, '0')
  const base = `${date}-${seq}-${slug}`
  let name = `${base}.${ext}`
  let suffix = 1
  while (used.has(name)) {
    name = `${base}-${++suffix}.${ext}`
  }
  used.add(name)

  return folderPrefix ? `${folderPrefix}/${name}` : name
}
