'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { BACard } from '@/components/design/card'
import { BAEyebrow } from '@/components/design/eyebrow'
import { IconCheck, IconUpload } from '@/components/design/icons'

const MAX_BYTES = 50 * 1024 * 1024
const PALETTE = ['#9DA989', '#C7956D', '#7B8AA1', '#A6927A', '#8E9485', '#B98E72']

type Item = {
  id: string
  fileName: string
  color: string
  state: 'uploading' | 'processing' | 'done' | 'error'
  progress: number
  caption: string
  rowId?: string
  errorMessage?: string
}

let nextItemId = 1

export function PhotosUploader() {
  const [items, setItems] = useState<Item[]>([])
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return
    const newItems: Item[] = []
    let oversize = false
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_BYTES) {
        oversize = true
        continue
      }
      const id = `tmp-${nextItemId++}`
      newItems.push({
        id,
        fileName: file.name,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        state: 'uploading',
        progress: 0,
        caption: '',
      })
      void uploadOne(id, file)
    }
    if (oversize) {
      setError("Y'en a un qui fait sa diva (>50 Mo). Réessaie ou prends-en un plus léger.")
    } else {
      setError(null)
    }
    setItems((prev) => [...prev, ...newItems])
  }

  async function uploadOne(itemId: string, file: File) {
    try {
      // 1. Sign
      const signRes = await fetch('/api/photos/sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
        }),
      })
      if (!signRes.ok) {
        const errBody = await signRes.json().catch(() => ({}))
        const msg =
          errBody.error === 'rate_limited'
            ? 'Tu uploades vite. Reviens dans une heure.'
            : 'Impossible de générer le lien.'
        markError(itemId, msg)
        return
      }
      const sign = (await signRes.json()) as {
        signed_url: string
        path: string
        bucket: string
        token: string
        content_type: string
      }

      // 2. PUT direct vers Supabase Storage avec progress (XHR)
      await uploadWithProgress(sign.signed_url, file, sign.content_type, (pct) => {
        setItems((cur) =>
          cur.map((it) => (it.id === itemId ? { ...it, progress: pct } : it)),
        )
      })

      // 3. Process (resize + DB row)
      setItems((cur) =>
        cur.map((it) => (it.id === itemId ? { ...it, state: 'processing', progress: 100 } : it)),
      )
      const procRes = await fetch('/api/photos/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: sign.path,
          caption: '',
          content_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
        }),
      })
      if (!procRes.ok) {
        markError(itemId, "Le serveur a hoqueté pendant le traitement.")
        return
      }
      const proc = (await procRes.json()) as { ok: boolean; id: string }
      setItems((cur) =>
        cur.map((it) =>
          it.id === itemId ? { ...it, state: 'done', progress: 100, rowId: proc.id } : it,
        ),
      )
    } catch (err) {
      console.error('[uploader]', err)
      markError(itemId, 'Erreur réseau. Réessaie.')
    }
  }

  function markError(itemId: string, message: string) {
    setItems((cur) =>
      cur.map((it) =>
        it.id === itemId ? { ...it, state: 'error', errorMessage: message } : it,
      ),
    )
  }

  function setCaption(itemId: string, caption: string) {
    setItems((cur) =>
      cur.map((it) => (it.id === itemId ? { ...it, caption } : it)),
    )
  }

  async function commitCaption(item: Item) {
    if (!item.rowId) return
    await fetch('/api/photos/update-caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.rowId, caption: item.caption }),
    }).catch(() => {})
  }

  return (
    <>
      {/* Drop zone */}
      <div className="px-[22px]">
        <div
          className="ba-drop"
          data-active={active}
          onDragOver={(e) => {
            e.preventDefault()
            setActive(true)
          }}
          onDragLeave={() => setActive(false)}
          onDrop={(e) => {
            e.preventDefault()
            setActive(false)
            addFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
          role="button"
          tabIndex={0}
          style={{
            background: active ? 'rgba(184,84,59,.06)' : '#FBF7EE',
            borderRadius: 18,
            padding: '32px 22px',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          <div
            className="rounded-full text-stamp flex items-center justify-center mx-auto mb-[14px] ba-paper-deep"
            style={{ width: 56, height: 56 }}
          >
            <IconUpload size={28} />
          </div>
          <div className="font-serif text-[22px] leading-[1.1]">Glisse tes photos.</div>
          <div className="text-[13px] text-ink-soft mt-[6px] leading-[1.45]">
            Ou{' '}
            <span className="underline underline-offset-[2px]">fouille dans ton téléphone</span>.
            JPEG, HEIC, PNG, vidéos. Jusqu&apos;à 50 Mo l&apos;unité.
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
          />
        </div>
        {error && (
          <div
            className="ba-fade mt-[10px] text-[13px] leading-[1.45] rounded-[10px] px-[14px] py-[10px]"
            style={{ background: 'rgba(184,84,59,.08)', color: 'var(--color-stamp-deep)' }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="px-[22px] pt-[20px]">
          <div className="flex items-center justify-between mb-[10px]">
            <BAEyebrow>Tes envois</BAEyebrow>
            <div className="text-[12px] text-ink-mute">
              {items.length} photo{items.length > 1 ? 's' : ''}
            </div>
          </div>
          <div className="flex flex-col gap-[10px]">
            {items.map((it) => (
              <BACard key={it.id} className="p-[12px] flex items-center gap-[12px]">
                <div
                  className="rounded-[8px] shrink-0 relative overflow-hidden"
                  style={{
                    width: 56,
                    height: 56,
                    background: `linear-gradient(135deg, ${it.color}, ${it.color}cc)`,
                  }}
                >
                  {(it.state === 'uploading' || it.state === 'processing') && (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-paper text-[11px] font-semibold"
                      style={{ background: 'rgba(21,35,59,.45)' }}
                    >
                      {it.state === 'processing' ? '…' : `${Math.round(it.progress)}%`}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {it.state === 'uploading' || it.state === 'processing' ? (
                    <>
                      <div className="text-[13px] text-ink font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                        {it.fileName}
                      </div>
                      <div
                        className="ba-paper-deep h-[3px] rounded-[2px] mt-[8px] overflow-hidden"
                      >
                        <div
                          className="bg-stamp h-full"
                          style={{
                            width: `${it.progress}%`,
                            transition: 'width .2s linear',
                          }}
                        />
                      </div>
                    </>
                  ) : it.state === 'done' ? (
                    <>
                      <input
                        type="text"
                        value={it.caption}
                        onChange={(e) => setCaption(it.id, e.target.value)}
                        onBlur={() => void commitCaption(it)}
                        placeholder="Quand ? Où ?"
                        className="w-full bg-transparent outline-none text-[14px] text-ink py-[4px]"
                        style={{ borderBottom: '1px dashed var(--color-paper-edge)' }}
                      />
                      <div className="text-[11px] text-success mt-[6px] flex items-center gap-[4px]">
                        <IconCheck size={12} /> envoyé · entre nous
                      </div>
                    </>
                  ) : (
                    <div className="text-[13px] text-stamp-deep">{it.errorMessage}</div>
                  )}
                </div>
              </BACard>
            ))}
          </div>
        </div>
      )}

      <div className="px-[22px] pt-[24px] pb-[30px] text-center">
        <Link
          href="/merci?from=photos"
          className="ba-btn bg-transparent text-ink p-[8px] text-[14px] underline underline-offset-[3px]"
        >
          j&apos;ai fini pour aujourd&apos;hui →
        </Link>
      </div>
    </>
  )
}

function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress((e.loaded / e.total) * 100)
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`upload status ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('upload network error'))
    xhr.send(file)
  })
}
