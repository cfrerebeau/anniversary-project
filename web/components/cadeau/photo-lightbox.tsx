'use client'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

export type LightboxPhoto = {
  id: string
  url: string
  downloadUrl: string
  downloadFilename: string
  caption: string | null
  contentType: string | null
}

export type PhotoLightboxHandle = {
  open: (index: number) => void
}

type Props = {
  photos: LightboxPhoto[]
  onClose?: () => void
  ref?: React.Ref<PhotoLightboxHandle>
}

const SWIPE_MIN_PX = 50
const SWIPE_H_DOMINANCE = 1.5
const IOS_EDGE_PX = 30 // ne pas déclencher swipe-back iOS

function isVideo(p: LightboxPhoto): boolean {
  return p.contentType?.startsWith('video/') ?? false
}

export function PhotoLightbox({ photos, onClose, ref }: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [index, setIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  // Capture la valeur de `body.overflow` au moment de l'ouverture pour ne
  // restaurer que si on est toujours le verrou actif (gestion de stacking).
  const bodyOverflowRef = useRef<string | null>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useImperativeHandle(
    ref,
    () => ({
      open: (i: number) => {
        if (i < 0 || i >= photos.length) return
        setIndex(i)
        setIsOpen(true)
      },
    }),
    [photos.length],
  )

  // Sync État React → DOM : ouvre/ferme le natif <dialog> via effet, après
  // que React ait commit (sinon showModal voit l'ancien `index` et flash).
  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (isOpen && !dlg.open) {
      try {
        dlg.showModal()
      } catch {
        // déjà ouvert ou pas attaché — ignore
      }
    } else if (!isOpen && dlg.open) {
      try {
        dlg.close()
      } catch {
        // pas ouvert — ignore
      }
    }
  }, [isOpen])

  // Évènements natifs `cancel` (Esc) et `close` (programmatique).
  // `close` est la source unique de vérité pour `setIsOpen(false)` + onClose.
  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    function onCloseEvt() {
      setIsOpen(false)
      onCloseRef.current?.()
    }
    dlg.addEventListener('close', onCloseEvt)
    return () => {
      dlg.removeEventListener('close', onCloseEvt)
    }
  }, [])

  // Trigger programmatique : flip l'état, l'effet ci-dessus appelle dlg.close()
  // qui émet le natif 'close', qui set isOpen=false + onClose une seule fois.
  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, photos.length - 1))
  }, [photos.length])
  const prev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0))
  }, [])
  const first = useCallback(() => setIndex(0), [])
  const last = useCallback(
    () => setIndex(Math.max(0, photos.length - 1)),
    [photos.length],
  )

  // Clamp l'index au render plutôt que via un effet — évite la lint rule
   // « setState in effect » et garantit que le render ne déréférence jamais
   // un index out-of-bounds si `photos` rétrécit.
   const safeIndex =
     photos.length === 0 ? 0 : Math.min(Math.max(index, 0), photos.length - 1)

  // Listener clavier — uniquement quand la lightbox est ouverte.
  useEffect(() => {
    if (!isOpen) return
    const single = photos.length <= 1
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        if (single) return
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        if (single) return
        e.preventDefault()
        prev()
      } else if (e.key === 'Home') {
        if (single) return
        e.preventDefault()
        first()
      } else if (e.key === 'End') {
        if (single) return
        e.preventDefault()
        last()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, photos.length, next, prev, first, last])

  // Lock body scroll. Restore uniquement si on est encore le verrou (current
  // value === 'hidden' qu'on a posé), sinon on respecte un overlay empilé.
  useEffect(() => {
    if (!isOpen) return
    bodyOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = bodyOverflowRef.current ?? ''
      }
      bodyOverflowRef.current = null
    }
  }, [isOpen])

  // Swipe horizontal — PointerEvents, intent-based. On ignore les pointers
  // qui démarrent sur des éléments interactifs (boutons, lien, vidéo) pour
  // ne pas convertir un tap sur la scrubber vidéo en swipe.
  const swipeStartRef = useRef<{ x: number; y: number; id: number } | null>(null)
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse') return
    if (e.clientX < IOS_EDGE_PX) return
    if (swipeStartRef.current != null) return
    const target = e.target as Element | null
    if (target?.closest('button,a,video,input,textarea')) return
    swipeStartRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const start = swipeStartRef.current
    if (!start || start.id !== e.pointerId) return
    swipeStartRef.current = null
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_PX) return
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_H_DOMINANCE) return
    if (photos.length <= 1) return
    if (dx < 0) next()
    else prev()
  }
  function onPointerCancel() {
    swipeStartRef.current = null
  }

  const photo = photos[safeIndex]
  const hasMany = photos.length > 1
  const captionId = photo?.caption ? `lightbox-caption-${photo.id}` : undefined

  return (
    <dialog
      ref={dialogRef}
      aria-label="Photo en grand"
      aria-describedby={captionId}
      className="bg-transparent p-0 m-0 max-w-none max-h-none w-screen h-[100dvh] backdrop:bg-ink/85"
    >
      {photo && (
        <div
          ref={innerRef}
          className="relative w-full h-full flex items-center justify-center"
          // Pas de `touch-action` ici — sinon le compositor bloque le
          // edge-swipe-back iOS avant que notre JS guard ne s'exécute.
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClick={(e) => {
            // Backdrop-équivalent : clic dans le wrapper en dehors des
            // contrôles/media → ferme. On compare contre le wrapper lui-même
            // (pas la dialog : la dialog est masquée par ce wrapper).
            if (e.target === e.currentTarget) close()
          }}
        >
          {/* Compteur */}
          <div
            className="absolute top-[14px] left-[14px] z-30 text-paper/70 text-[12px] font-mono tracking-[0.1em] pointer-events-none"
          >
            {safeIndex + 1} / {photos.length}
          </div>

          {/* Contrôles top-right */}
          <div className="absolute top-[14px] right-[14px] z-30 flex gap-[8px]">
            {hasMany && (
              <ControlButton ariaLabel="Photo précédente (←)" onClick={prev}>
                ‹
              </ControlButton>
            )}
            {hasMany && (
              <ControlButton ariaLabel="Photo suivante (→)" onClick={next}>
                ›
              </ControlButton>
            )}
            <a
              href={photo.downloadUrl}
              className="bg-ink/60 hover:bg-ink/80 text-paper rounded-[10px] px-[12px] py-[8px] text-[13px] backdrop-blur border border-white/10"
              aria-label="Télécharger la photo"
            >
              ↓ Télécharger
            </a>
            <ControlButton ariaLabel="Fermer (Échap)" onClick={close}>
              ✕
            </ControlButton>
          </div>

          {/* Médias — key=photo.id pour force-remount (sinon une vidéo en
              lecture continue après Next/Close). */}
          {isVideo(photo) ? (
            <video
              key={photo.id}
              src={photo.url}
              controls
              preload="metadata"
              playsInline
              className="max-w-[95vw] max-h-[90dvh]"
              style={{ objectFit: 'contain' }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.caption ?? 'Photo en grand'}
              className="max-w-[95vw] max-h-[90dvh]"
              style={{ objectFit: 'contain' }}
            />
          )}

          {/* Caption au-dessous, scrollable si trop longue */}
          {photo.caption && (
            <div
              id={captionId}
              className="absolute left-1/2 -translate-x-1/2 max-w-[min(80vw,720px)] max-h-[15vh] overflow-y-auto text-center text-[14px] text-paper/85 bg-ink/45 backdrop-blur px-3 py-2 rounded-[8px] z-20"
              style={{
                bottom: 'max(1rem, env(safe-area-inset-bottom))',
                wordBreak: 'break-word',
              }}
            >
              {photo.caption}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}

function ControlButton({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="bg-ink/60 hover:bg-ink/80 text-paper rounded-[10px] px-[12px] py-[8px] text-[14px] backdrop-blur border border-white/10"
    >
      {children}
    </button>
  )
}
