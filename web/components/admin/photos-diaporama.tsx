'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import { BAPrimary, BASecondary } from '@/components/design/buttons'
import {
  DEFAULT_CONFIG,
  SESSION_STORAGE_KEY,
  TRANSITION_DURATION_MS,
  URL_REFRESH_AT_MS,
  clampConfig,
  inAnimationClass,
  isVideo,
  outAnimationClass,
  pickTransitionKind,
  resumeFromSnapshot,
  shuffle,
  type DiaporamaConfig,
  type PhotoLite,
  type ResumeSnapshot,
  type TransitionKind,
} from './photos-diaporama.helpers'

type Phase = 'idle' | 'config' | 'playing'

type PlayState = {
  order: string[]
  index: number
  config: DiaporamaConfig
}

type UrlOverride = { url: string; issuedAt: number }

export function PhotosDiaporama({ photos }: { photos: PhotoLite[] }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [snapshot, setSnapshot] = useState<ResumeSnapshot | null>(null)
  const [playState, setPlayState] = useState<PlayState | null>(null)
  // On garde uniquement les URLs rafraîchies côté client ; la liste des photos
  // reste dérivée des props pour rester synchro automatiquement sans effet.
  const [urlOverrides, setUrlOverrides] = useState<Record<string, UrlOverride>>({})
  const launcherRef = useRef<HTMLDivElement | null>(null)

  const livePhotos = useMemo(
    () =>
      photos.map((p) => {
        const override = urlOverrides[p.id]
        return override && override.issuedAt > p.urlIssuedAt
          ? { ...p, url: override.url, urlIssuedAt: override.issuedAt }
          : p
      }),
    [photos, urlOverrides],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as ResumeSnapshot
      if (!parsed.order || !parsed.currentPhotoId) return
      // Lecture one-shot d'une API externe (sessionStorage) au montage : la
      // règle react-hooks/set-state-in-effect ne propose pas d'idiome plus
      // propre que useSyncExternalStore, surdimensionné ici.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnapshot(parsed)
    } catch {
      // snapshot corrompu : on ignore
    }
  }, [])

  const photoIds = useMemo(() => new Set(livePhotos.map((p) => p.id)), [livePhotos])
  const resumePoint = useMemo(
    () => (snapshot ? resumeFromSnapshot(snapshot, photoIds) : null),
    [snapshot, photoIds],
  )

  const clearSnapshot = useCallback(() => {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    } catch {
      // sessionStorage indisponible : on ignore
    }
    setSnapshot(null)
  }, [])

  const writeSnapshot = useCallback((snap: ResumeSnapshot) => {
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snap))
    } catch {
      // ignore
    }
    setSnapshot(snap)
  }, [])

  function startFresh(config: DiaporamaConfig) {
    if (livePhotos.length === 0) return
    const ids = livePhotos.map((p) => p.id)
    const order = config.random ? shuffle(ids) : ids
    setPlayState({ order, index: 0, config })
    setPhase('playing')
    clearSnapshot()
  }

  function resume() {
    if (!snapshot || !resumePoint) return
    setPlayState({ order: resumePoint.order, index: resumePoint.index, config: snapshot.config })
    setPhase('playing')
  }

  function exitPlayer(finalSnapshot: ResumeSnapshot | null) {
    setPhase('idle')
    setPlayState(null)
    if (finalSnapshot) writeSnapshot(finalSnapshot)
    else clearSnapshot()
    requestAnimationFrame(() => {
      const root = launcherRef.current
      const btn = root?.querySelector<HTMLButtonElement>('button[data-diaporama-launcher]')
      btn?.focus()
    })
  }

  return (
    <>
      <div ref={launcherRef} className="px-[22px] pb-[16px]">
        <DiaporamaLauncher
          hasPhotos={livePhotos.length > 0}
          hasResume={Boolean(resumePoint)}
          onOpenConfig={() => setPhase('config')}
          onResume={resume}
          onClearResume={() => {
            clearSnapshot()
            setPhase('config')
          }}
        />
      </div>

      {phase === 'config' && (
        <ConfigDialog
          initial={snapshot?.config ?? DEFAULT_CONFIG}
          onCancel={() => setPhase('idle')}
          onStart={startFresh}
        />
      )}

      {phase === 'playing' && playState && (
        <Player
          photos={livePhotos}
          order={playState.order}
          startIndex={playState.index}
          config={playState.config}
          onExit={exitPlayer}
          onPhotosRefreshed={(updates) => {
            // Bail si rien à appliquer (photo supprimée côté DB → l'API omet
            // l'ID, donc updates = {}). Sans ce garde, on créerait une nouvelle
            // ref de state à chaque call, ce qui re-déclencherait l'effet de
            // refresh en boucle infinie sur les IDs qui ne reviendront jamais.
            if (Object.keys(updates).length === 0) return
            setUrlOverrides((prev) => ({ ...prev, ...updates }))
          }}
        />
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Launcher
// ────────────────────────────────────────────────────────────────────────────

function DiaporamaLauncher({
  hasPhotos,
  hasResume,
  onOpenConfig,
  onResume,
  onClearResume,
}: {
  hasPhotos: boolean
  hasResume: boolean
  onOpenConfig: () => void
  onResume: () => void
  onClearResume: () => void
}) {
  if (!hasPhotos) {
    return (
      <div className="text-ink-mute text-[13px]">
        Le diaporama sera disponible dès qu&apos;une photo aura été partagée.
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-[10px] items-center">
      {hasResume ? (
        <>
          <BAPrimary data-diaporama-launcher onClick={onResume}>
            Reprendre le diaporama
          </BAPrimary>
          <BASecondary onClick={onClearResume}>Recommencer</BASecondary>
        </>
      ) : (
        <BAPrimary data-diaporama-launcher onClick={onOpenConfig}>
          Lancer le diaporama
        </BAPrimary>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Config dialog
// ────────────────────────────────────────────────────────────────────────────

function ConfigDialog({
  initial,
  onCancel,
  onStart,
}: {
  initial: DiaporamaConfig
  onCancel: () => void
  onStart: (config: DiaporamaConfig) => void
}) {
  const titleId = useId()
  const [random, setRandom] = useState(initial.random)
  const [timePerPhoto, setTimePerPhoto] = useState<number | ''>(initial.timePerPhoto)
  const [transition, setTransition] = useState<DiaporamaConfig['transition']>(initial.transition)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    firstFieldRef.current?.focus()
    return () => {
      previouslyFocused?.focus?.()
    }
  }, [])

  // Focus trap + Escape pour fermer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key !== 'Tab') return
      const root = dialogRef.current
      if (!root) return
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      // Cas où le focus a quitté la modale (clic sur la barre d'URL puis Tab) :
      // on le ramène à l'intérieur plutôt que de laisser tabuler la page.
      if (!active || !root.contains(active)) {
        e.preventDefault()
        first.focus()
        return
      }
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const config = clampConfig({
      random,
      timePerPhoto: typeof timePerPhoto === 'number' ? timePerPhoto : DEFAULT_CONFIG.timePerPhoto,
      transition,
    })
    onStart(config)
  }

  function onTimeChange(e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    if (v === '') {
      setTimePerPhoto('')
      return
    }
    const n = Number(v)
    setTimePerPhoto(Number.isFinite(n) ? n : '')
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-[16px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-paper text-ink rounded-[18px] border border-paper-edge w-full max-w-[420px] p-[22px]"
        style={{ boxShadow: '0 12px 32px -10px rgba(21,35,59,.4)' }}
      >
        <h2 id={titleId} className="font-serif text-[22px] leading-tight mb-[14px]">
          Diaporama
        </h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-[14px]">
          <label className="flex items-center gap-[10px] text-[14px]">
            <input
              ref={firstFieldRef}
              type="checkbox"
              checked={random}
              onChange={(e) => setRandom(e.target.checked)}
              className="h-[16px] w-[16px]"
            />
            <span>Ordre aléatoire</span>
          </label>

          <label className="flex flex-col gap-[4px] text-[14px]">
            <span>Durée par photo (secondes)</span>
            <input
              type="number"
              inputMode="numeric"
              min={2}
              max={30}
              step={1}
              value={timePerPhoto}
              onChange={onTimeChange}
              className="border border-paper-edge rounded-[10px] px-[10px] py-[8px] bg-paper-soft text-ink"
            />
            <span className="text-[12px] text-ink-mute">
              Entre 2 et 30 secondes. Les vidéos sont lues jusqu&apos;au bout.
            </span>
          </label>

          <label className="flex flex-col gap-[4px] text-[14px]">
            <span>Transition</span>
            <select
              value={transition}
              onChange={(e) =>
                setTransition(e.target.value as DiaporamaConfig['transition'])
              }
              className="border border-paper-edge rounded-[10px] px-[10px] py-[8px] bg-paper-soft text-ink"
            >
              <option value="random">Aléatoire</option>
              <option value="fade">Fondu</option>
              <option value="slide">Glissement</option>
              <option value="zoom">Zoom</option>
              <option value="cut">Cut</option>
            </select>
            {transition === 'random' && (
              <span className="text-[12px] text-ink-mute">
                Une transition différente à chaque photo.
              </span>
            )}
          </label>

          <div className="flex gap-[10px] justify-end pt-[6px]">
            <BASecondary type="button" onClick={onCancel}>
              Annuler
            </BASecondary>
            <BAPrimary type="submit">Démarrer</BAPrimary>
          </div>
        </form>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Player
// ────────────────────────────────────────────────────────────────────────────

type RefreshUpdate = Record<string, { url: string; issuedAt: number }>

type DisplayedItem = {
  photo: PhotoLite
  tick: number // pour forcer un remount via React key et rejouer l'animation
}

function Player({
  photos,
  order,
  startIndex,
  config,
  onExit,
  onPhotosRefreshed,
}: {
  photos: PhotoLite[]
  order: string[]
  startIndex: number
  config: DiaporamaConfig
  onExit: (snapshot: ResumeSnapshot | null) => void
  onPhotosRefreshed: (updates: RefreshUpdate) => void
}) {
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos])
  const getPhoto = useCallback(
    (id: string | undefined): PhotoLite | null => (id ? byId.get(id) ?? null : null),
    [byId],
  )

  const [index, setIndex] = useState(startIndex)
  const [tick, setTick] = useState(0)
  const [transitionKind, setTransitionKind] = useState<TransitionKind>(() =>
    pickTransitionKind(config.transition, null),
  )
  const lastKindRef = useRef<TransitionKind | null>(null)
  // Calque sortant (item précédent) — null sauf pendant une transition.
  const [outgoing, setOutgoing] = useState<DisplayedItem | null>(null)

  const [isPaused, setIsPaused] = useState(false)
  const [awaitingUserGesture, setAwaitingUserGesture] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mediaError, setMediaError] = useState(false)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const failureStreak = useRef(0)

  const overlayRef = useRef<HTMLDivElement | null>(null)
  const pauseButtonRef = useRef<HTMLButtonElement | null>(null)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeVideoRef = useRef<HTMLVideoElement | null>(null)
  const transitionLockRef = useRef(false)

  const currentPhoto = getPhoto(order[index])
  const nextPhoto = getPhoto(order[index + 1])
  const currentIsVideo = isVideo(currentPhoto)

  // ── Préload du prochain item via Image() ──────────────────────────────────
  useEffect(() => {
    if (!nextPhoto) return
    if (isVideo(nextPhoto)) return // pas la peine pour les vidéos
    const img = new Image()
    img.src = nextPhoto.url
  }, [nextPhoto])

  // ── Focus initial ─────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    pauseButtonRef.current?.focus()
  }, [])

  // ── Timer d'avancement (images uniquement) ────────────────────────────────
  const clearAdvance = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
  }, [])

  const clearErrorAdvance = useCallback(() => {
    if (errorAdvanceTimerRef.current) {
      clearTimeout(errorAdvanceTimerRef.current)
      errorAdvanceTimerRef.current = null
    }
  }, [])

  // ── Visibilité onglet : pause auto ────────────────────────────────────────
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        setIsPaused(true)
        activeVideoRef.current?.pause()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // ── Auto-hide des contrôles ───────────────────────────────────────────────
  const bumpControls = useCallback(() => {
    setShowControls(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    if (isPaused || awaitingUserGesture || mediaError || fatalError) return
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 2000)
  }, [isPaused, awaitingUserGesture, mediaError, fatalError])

  useEffect(() => {
    // Affiche les contrôles au montage puis programme leur auto-hide ; setState
    // dans cet effet est volontaire (sync avec le timer DOM).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    bumpControls()
    function onActivity() {
      bumpControls()
    }
    window.addEventListener('pointermove', onActivity)
    window.addEventListener('pointerdown', onActivity)
    window.addEventListener('keydown', onActivity)
    window.addEventListener('focusin', onActivity)
    return () => {
      window.removeEventListener('pointermove', onActivity)
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
      window.removeEventListener('focusin', onActivity)
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    }
  }, [bumpControls])

  // ── Avancement / précédent ────────────────────────────────────────────────
  const startTransitionTo = useCallback(
    (nextIndex: number) => {
      if (transitionLockRef.current) return
      if (nextIndex < 0) return
      if (nextIndex >= order.length) {
        // Fin de la liste : on sort proprement et on efface le snapshot.
        onExit(null)
        return
      }
      const kind = pickTransitionKind(config.transition, lastKindRef.current)
      lastKindRef.current = kind
      setTransitionKind(kind)

      // Calque sortant : l'item courant qui s'en va. Vidéo : on l'arrête pour
      // qu'aucun son ne fuite pendant l'animation.
      const prevPhoto = currentPhoto
      if (prevPhoto && isVideo(prevPhoto)) {
        activeVideoRef.current?.pause()
        activeVideoRef.current = null
      }
      setOutgoing(prevPhoto ? { photo: prevPhoto, tick } : null)

      setIndex(nextIndex)
      setTick((t) => t + 1)
      transitionLockRef.current = true

      const duration = TRANSITION_DURATION_MS[kind]
      window.setTimeout(() => {
        setOutgoing(null)
        transitionLockRef.current = false
      }, duration + 30)
    },
    [config.transition, currentPhoto, order, onExit, tick],
  )

  const advance = useCallback(() => startTransitionTo(index + 1), [index, startTransitionTo])
  const prev = useCallback(
    () => startTransitionTo(Math.max(0, index - 1)),
    [index, startTransitionTo],
  )

  const togglePause = useCallback(() => {
    setIsPaused((p) => {
      const newPaused = !p
      const video = activeVideoRef.current
      if (newPaused) video?.pause()
      else void video?.play().catch(() => {})
      return newPaused
    })
  }, [])

  // Reset l'état d'erreur média à chaque changement d'item — ou quand l'URL
  // courante est rafraîchie (un refresh signé arrivé après un 403 sur l'URL
  // précédente doit annuler l'auto-skip et laisser le média tenter à nouveau).
  const currentUrl = currentPhoto?.url
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMediaError(false)
    clearErrorAdvance()
    setAwaitingUserGesture(false)
    return clearErrorAdvance
  }, [index, currentUrl, clearErrorAdvance])

  // Si la photo courante disparaît (suppression côté DB pendant la lecture),
  // avance plutôt que de rester bloqué sur un écran noir sans timer.
  useEffect(() => {
    if (!currentPhoto && index < order.length) {
      advance()
    }
  }, [currentPhoto, index, order.length, advance])

  // Timer d'avancement principal : déclenche après timePerPhoto pour les images.
  useEffect(() => {
    clearAdvance()
    if (isPaused || awaitingUserGesture || mediaError || fatalError) return
    if (!currentPhoto) return
    if (currentIsVideo) return // attente de onEnded
    advanceTimerRef.current = setTimeout(
      () => advance(),
      Math.max(0, config.timePerPhoto * 1000),
    )
    return clearAdvance
  }, [
    index,
    isPaused,
    awaitingUserGesture,
    mediaError,
    fatalError,
    currentIsVideo,
    currentPhoto,
    config.timePerPhoto,
    advance,
    clearAdvance,
  ])

  // ── Raccourcis clavier ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable)
          return
      }
      if (e.key === 'Escape') {
        // Fullscreen natif : laisser le navigateur en sortir d'abord.
        if (document.fullscreenElement) return
        e.preventDefault()
        exitWithSnapshot()
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        togglePause()
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        advance()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
        return
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFullscreen()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advance, prev, togglePause])

  // ── Fullscreen ────────────────────────────────────────────────────────────
  useEffect(() => {
    function onChange() {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      overlayRef.current?.requestFullscreen?.().catch(() => {})
    }
  }

  // ── Snapshot d'exit ───────────────────────────────────────────────────────
  const buildSnapshot = useCallback((): ResumeSnapshot | null => {
    const photoId = order[index]
    if (!photoId) return null
    return {
      config,
      order,
      currentPhotoId: photoId,
      currentIndex: index,
      savedAt: Date.now(),
    }
  }, [order, index, config])

  function exitWithSnapshot() {
    onExit(buildSnapshot())
  }

  // Pagehide : filet de sécurité si la page est cachée brutalement.
  useEffect(() => {
    function onPageHide() {
      const snap = buildSnapshot()
      if (snap) {
        try {
          window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snap))
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [buildSnapshot])

  // ── Refresh des URLs signées avant expiration ─────────────────────────────
  const refreshInflight = useRef(false)
  const refreshUpcomingIfStale = useCallback(async () => {
    if (refreshInflight.current) return
    const horizon = 3
    const idsToCheck: string[] = []
    const now = Date.now()
    for (let i = 0; i < horizon; i++) {
      const photo = getPhoto(order[index + i])
      if (photo && now - photo.urlIssuedAt >= URL_REFRESH_AT_MS) {
        idsToCheck.push(photo.id)
      }
    }
    if (idsToCheck.length === 0) return
    refreshInflight.current = true
    try {
      const res = await fetch('/api/admin/photos/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: idsToCheck }),
      })
      if (!res.ok) return
      const json = (await res.json()) as { urls: RefreshUpdate }
      onPhotosRefreshed(json.urls)
    } catch {
      // on retentera au prochain tick
    } finally {
      refreshInflight.current = false
    }
  }, [order, index, getPhoto, onPhotosRefreshed])

  useEffect(() => {
    void refreshUpcomingIfStale()
    const interval = setInterval(() => void refreshUpcomingIfStale(), 60_000)
    return () => clearInterval(interval)
  }, [refreshUpcomingIfStale])

  // ── Lecture vidéo (autoplay + erreur) ─────────────────────────────────────
  function onActiveVideoMount(el: HTMLVideoElement | null) {
    activeVideoRef.current = el
    if (!el) return
    setAwaitingUserGesture(false)
    void el.play().catch((err: unknown) => {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError') {
        setAwaitingUserGesture(true)
        bumpControls()
      } else {
        handleMediaError()
      }
    })
  }

  function resumeAfterUserGesture() {
    setAwaitingUserGesture(false)
    void activeVideoRef.current?.play().catch(() => handleMediaError())
  }

  function handleMediaError() {
    failureStreak.current += 1
    if (failureStreak.current >= 3) {
      setFatalError('Plusieurs médias n’ont pas pu être chargés. Diaporama arrêté.')
      clearAdvance()
      clearErrorAdvance()
      return
    }
    setMediaError(true)
    clearAdvance()
    clearErrorAdvance()
    errorAdvanceTimerRef.current = setTimeout(() => {
      setMediaError(false)
      advance()
    }, 1500)
  }

  function handleMediaLoadSuccess() {
    failureStreak.current = 0
  }

  // ── Touch zones ───────────────────────────────────────────────────────────
  function onTouchZone(side: 'left' | 'middle' | 'right') {
    if (side === 'left') prev()
    else if (side === 'right') advance()
    else {
      if (showControls) togglePause()
      else bumpControls()
    }
  }

  // ── Variables CSS pour Ken Burns (durée = timePerPhoto) ───────────────────
  const overlayStyle: CSSProperties = {
    width: '100dvw',
    height: '100dvh',
    // @ts-expect-error CSS custom property
    '--dia-kb-duration': `${config.timePerPhoto}s`,
  }

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Diaporama"
      className="fixed inset-0 z-50 bg-ink overflow-hidden"
      style={overlayStyle}
    >
      {/* Calque sortant (juste pendant la transition). Le key sur tick force
          le remount si deux transitions consécutives tirent la même animation
          (sans ça l'animation CSS ne rejoue pas). */}
      {outgoing && (
        <MediaLayer
          key={`out-${outgoing.photo.id}:${outgoing.tick}`}
          item={outgoing.photo}
          animationClass={outAnimationClass(transitionKind)}
          isActive={false}
          kenBurns={false}
          videoRefSetter={null}
          onError={undefined}
          onLoad={undefined}
        />
      )}
      {/* Calque entrant / actif */}
      {currentPhoto && (
        <MediaLayer
          key={`${currentPhoto.id}:${tick}`}
          item={currentPhoto}
          animationClass={inAnimationClass(transitionKind)}
          isActive
          kenBurns={transitionKind === 'zoom' && !currentIsVideo}
          videoRefSetter={onActiveVideoMount}
          onEnded={advance}
          onError={handleMediaError}
          onLoad={handleMediaLoadSuccess}
        />
      )}

      {/* Touch zones */}
      <button
        type="button"
        aria-label="Photo précédente"
        className="absolute top-0 left-0 h-full z-10"
        style={{ width: '30%' }}
        onClick={() => onTouchZone('left')}
      />
      <button
        type="button"
        aria-label="Afficher / masquer les contrôles"
        className="absolute top-0 z-10"
        style={{ left: '30%', width: '40%', height: '100%' }}
        onClick={() => onTouchZone('middle')}
      />
      <button
        type="button"
        aria-label="Photo suivante"
        className="absolute top-0 right-0 h-full z-10"
        style={{ width: '30%' }}
        onClick={() => onTouchZone('right')}
      />

      {/* Caption */}
      {currentPhoto?.caption && (
        <div
          className="absolute left-1/2 -translate-x-1/2 max-w-[min(80vw,720px)] text-center text-sm text-paper/85 bg-ink/45 backdrop-blur px-3 py-1 rounded-[6px] line-clamp-3 z-20 pointer-events-none"
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          {currentPhoto.caption}
        </div>
      )}

      {/* Contrôles top-right */}
      <div
        className={`absolute top-[14px] right-[14px] flex gap-[8px] z-30 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ControlButton
          ref={pauseButtonRef}
          ariaLabel={isPaused ? 'Reprendre' : 'Mettre en pause'}
          onClick={togglePause}
        >
          {isPaused ? 'Lecture' : 'Pause'}
        </ControlButton>
        <ControlButton ariaLabel="Photo précédente" onClick={prev}>
          ‹
        </ControlButton>
        <ControlButton ariaLabel="Photo suivante" onClick={advance}>
          ›
        </ControlButton>
        <ControlButton
          ariaLabel={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? '⤧' : '⤢'}
        </ControlButton>
        <ControlButton ariaLabel="Fermer le diaporama" onClick={exitWithSnapshot}>
          ✕
        </ControlButton>
      </div>

      {/* Indicateur position */}
      <div className="absolute top-[14px] left-[14px] z-30 text-paper/60 text-[12px] font-mono tracking-[0.1em]">
        {index + 1} / {order.length}
      </div>

      {/* Autoplay bloqué */}
      {awaitingUserGesture && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/60">
          <button
            type="button"
            className="ba-btn bg-paper text-ink rounded-[14px] px-[22px] py-[15px] text-[16px] font-semibold"
            onClick={resumeAfterUserGesture}
          >
            Cliquez pour démarrer la vidéo
          </button>
        </div>
      )}

      {/* Media error overlay */}
      {mediaError && !fatalError && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-40 flex items-center justify-center bg-ink/70 text-paper text-[14px]"
        >
          Média indisponible — passage au suivant…
        </div>
      )}

      {/* Erreur fatale */}
      {fatalError && (
        <div
          role="alert"
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-[14px] bg-ink/90 text-paper text-center px-[20px]"
        >
          <div>{fatalError}</div>
          <BAPrimary onClick={() => onExit(null)}>Fermer</BAPrimary>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Calque média (un calque = une animation in ou out)
// ────────────────────────────────────────────────────────────────────────────

function MediaLayer({
  item,
  animationClass,
  isActive,
  kenBurns,
  videoRefSetter,
  onEnded,
  onError,
  onLoad,
}: {
  item: PhotoLite
  animationClass: string
  isActive: boolean
  kenBurns: boolean
  videoRefSetter: ((el: HTMLVideoElement | null) => void) | null
  onEnded?: () => void
  onError?: () => void
  onLoad?: () => void
}) {
  const showAsVideo = isVideo(item)

  return (
    <div className={`absolute inset-0 ${animationClass}`}>
      {/* Backdrop flou pour adoucir les bandes noires sur photos en object-contain */}
      {!showAsVideo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 brightness-75 scale-110"
        />
      )}
      <div className={`absolute inset-0 ${kenBurns ? 'ba-dia-ken-burns' : ''}`}>
        {showAsVideo ? (
          <video
            ref={isActive ? videoRefSetter ?? undefined : undefined}
            src={item.url}
            autoPlay={isActive}
            playsInline
            className="absolute inset-0 w-full h-full object-contain"
            onEnded={isActive ? onEnded : undefined}
            onError={onError}
            onLoadedData={onLoad}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.caption ?? ''}
            className="absolute inset-0 w-full h-full object-contain"
            onError={onError}
            onLoad={onLoad}
          />
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Petits boutons de contrôle (forwardRef pour focus initial sur Pause)
// ────────────────────────────────────────────────────────────────────────────

type ControlButtonProps = {
  children: ReactNode
  ariaLabel: string
  onClick: () => void
}

const ControlButton = forwardRef<HTMLButtonElement, ControlButtonProps>(function ControlButton(
  { children, ariaLabel, onClick },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="bg-ink/60 hover:bg-ink/80 text-paper rounded-[10px] px-[12px] py-[8px] text-[14px] backdrop-blur border border-white/10"
    >
      {children}
    </button>
  )
})
