'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BACard } from '@/components/design/card'

type Props = {
  id: string
  url: string | null
  caption: string
  contentType: string | null
}

export function PhotoCard({ id, url, caption, contentType }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState(caption)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, startDelete] = useTransition()
  // Évite la race onBlur (commitCaption) ↔ click (delete). Quand l'user
  // clique « supprimer » avec le focus dans l'input, onBlur déclenche
  // commitCaption en parallèle ; on ne veut ni l'envoyer, ni montrer son
  // erreur si la photo est en cours de suppression.
  const deletingRef = useRef(false)
  const isVideo = contentType?.startsWith('video/')
  const captionInputId = `photo-caption-${id}`

  async function commitCaption() {
    if (deletingRef.current) return
    if (draft === caption) return
    try {
      const res = await fetch('/api/photos/update-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, caption: draft }),
      })
      if (!res.ok) throw new Error('caption update failed')
      // Refresh pour que la prop `caption` reflète la nouvelle valeur côté RSC.
      router.refresh()
    } catch {
      if (!deletingRef.current) setError("Légende non sauvegardée. Réessaie.")
    }
  }

  function onDeleteClick() {
    if (!window.confirm('Supprimer cette photo ? Action irréversible.')) return
    deletingRef.current = true
    setError(null)
    startDelete(async () => {
      try {
        const res = await fetch('/api/photos/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        if (!res.ok) throw new Error('delete failed')
        router.refresh()
      } catch {
        deletingRef.current = false
        setError('Suppression impossible. Réessaie.')
      }
    })
  }

  return (
    <BACard
      className="overflow-hidden p-0 relative"
      style={{ opacity: isDeleting ? 0.5 : 1, transition: 'opacity .15s' }}
    >
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
              alt={caption || 'Photo souvenir envoyée par toi'}
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
      <div className="p-[14px]">
        <label
          htmlFor={captionInputId}
          className="block text-[11px] text-ink-mute mb-[2px] leading-[1.3]"
        >
          Légende — <em className="italic">quand</em>, <em className="italic">où</em>, qui ?
        </label>
        <input
          id={captionInputId}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commitCaption()}
          maxLength={280}
          placeholder="ex. été 2019, à Lisbonne"
          disabled={isDeleting}
          className="w-full bg-transparent outline-none text-[14px] text-ink py-[4px]"
          style={{ borderBottom: '1px dashed var(--color-paper-edge)' }}
        />
        <div className="flex items-center justify-between mt-[10px]">
          {error ? (
            <div role="alert" className="text-[11px] text-stamp-deep">
              {error}
            </div>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onDeleteClick}
            disabled={isDeleting}
            className="ba-btn bg-transparent text-ink-mute p-[4px] text-[12px] underline underline-offset-[3px] hover:text-stamp-deep disabled:opacity-50"
          >
            {isDeleting ? 'suppression…' : 'supprimer'}
          </button>
        </div>
      </div>
    </BACard>
  )
}
