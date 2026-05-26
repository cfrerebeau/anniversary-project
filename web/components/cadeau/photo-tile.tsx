'use client'

import { BACard } from '@/components/design/card'

type Props = {
  id: string
  url: string | null
  caption: string | null
  contentType: string | null
  index: number
  total: number
  onOpen: (id: string) => void
}

export function PhotoTile({ id, url, caption, contentType, index, total, onOpen }: Props) {
  const isVideo = contentType?.startsWith('video/') ?? false
  const hasUrl = url != null
  return (
    <BACard className="overflow-hidden p-0 relative">
      <button
        type="button"
        onClick={() => hasUrl && onOpen(id)}
        disabled={!hasUrl}
        aria-label={`Voir la photo ${index + 1} sur ${total}`}
        className="block w-full text-left transition-transform duration-200 hover:scale-[1.03] focus:outline-none focus-visible:outline-2 focus-visible:outline-stamp disabled:cursor-not-allowed disabled:hover:scale-100"
        style={{ aspectRatio: '4 / 3', background: 'var(--color-paper-deep)' }}
      >
        {url ? (
          isVideo ? (
            <>
              <video
                src={url}
                muted
                preload="metadata"
                playsInline
                className="w-full h-full"
                style={{ objectFit: 'cover', display: 'block' }}
              />
              <span
                aria-hidden
                className="absolute bottom-[8px] right-[8px] bg-ink/70 text-paper rounded-full w-[28px] h-[28px] flex items-center justify-center text-[12px]"
              >
                ▶
              </span>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              loading="lazy"
              className="w-full h-full"
              style={{ objectFit: 'cover', display: 'block' }}
            />
          )
        ) : (
          <div className="flex items-center justify-center w-full h-full text-ink-mute text-[12px]">
            URL signée indisponible
          </div>
        )}
      </button>
      {caption && (
        <div className="p-[12px] text-[13px] leading-[1.4] text-ink-soft">{caption}</div>
      )}
    </BACard>
  )
}
