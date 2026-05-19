// Logique pure du diaporama admin. Extraite du composant pour rester testable
// (les tests Vitest tournent en `environment: 'node'`, sans DOM).

export type TransitionKind = 'fade' | 'slide' | 'zoom' | 'cut'
export type TransitionSetting = TransitionKind | 'random'

export type DiaporamaConfig = {
  random: boolean
  timePerPhoto: number // secondes, entier 2..30
  transition: TransitionSetting
}

export type PhotoLite = {
  id: string
  url: string
  urlIssuedAt: number
  caption: string | null
  contentType: string | null
  uploaderName: string | null
}

export type ResumeSnapshot = {
  config: DiaporamaConfig
  order: string[]
  currentPhotoId: string
  currentIndex: number
  savedAt: number
}

export const DEFAULT_CONFIG: DiaporamaConfig = {
  random: false,
  timePerPhoto: 5,
  transition: 'random',
}

export const TRANSITION_KINDS: TransitionKind[] = ['fade', 'slide', 'zoom', 'cut']
export const TRANSITION_DURATION_MS: Record<TransitionKind, number> = {
  fade: 700,
  slide: 700,
  zoom: 700,
  cut: 0,
}

export const SESSION_STORAGE_KEY = 'admin-diaporama-state'

// Refresh threshold : 25 min, sachant que les URLs signées vivent 30 min.
export const URL_REFRESH_AT_MS = 25 * 60 * 1000

export function clampConfig(input: Partial<DiaporamaConfig>): DiaporamaConfig {
  const merged = { ...DEFAULT_CONFIG, ...input }
  const t = Math.round(Number(merged.timePerPhoto))
  const timePerPhoto = Number.isFinite(t) ? Math.min(30, Math.max(2, t)) : DEFAULT_CONFIG.timePerPhoto
  const allowed: TransitionSetting[] = [...TRANSITION_KINDS, 'random']
  const transition = allowed.includes(merged.transition) ? merged.transition : DEFAULT_CONFIG.transition
  return {
    random: Boolean(merged.random),
    timePerPhoto,
    transition,
  }
}

// Fisher-Yates. Renvoie une nouvelle copie ; n'altère pas l'input.
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Pour la valeur 'random', on évite de répéter la même transition deux fois
// d'affilée pour mieux honorer l'intention "différente à chaque photo".
export function pickTransitionKind(
  setting: TransitionSetting,
  previous: TransitionKind | null,
  rng: () => number = Math.random,
): TransitionKind {
  if (setting !== 'random') return setting
  const pool = previous ? TRANSITION_KINDS.filter((k) => k !== previous) : TRANSITION_KINDS
  const idx = Math.floor(rng() * pool.length)
  return pool[idx]
}

// Calcule où reprendre étant donné un snapshot et la liste actuelle de photos.
// - On garde `currentPhotoId` comme source de vérité (résiste aux suppressions).
// - Sinon, on prend le premier ID survivant ≥ currentIndex dans l'ordre sauvegardé.
// - Sinon, on remonte vers le premier ID survivant avant currentIndex.
// - Si rien ne survit, renvoie null (snapshot à invalider).
export type ResumePoint = {
  order: string[] // ordre original filtré des IDs supprimés
  index: number // index dans `order` où reprendre
}

export function resumeFromSnapshot(
  snapshot: ResumeSnapshot,
  currentPhotoIds: ReadonlySet<string>,
): ResumePoint | null {
  const filtered = snapshot.order.filter((id) => currentPhotoIds.has(id))
  if (filtered.length === 0) return null

  // 1) currentPhotoId présent dans le filtré ?
  const directIdx = filtered.indexOf(snapshot.currentPhotoId)
  if (directIdx >= 0) return { order: filtered, index: directIdx }

  // 2) Premier survivant ≥ currentIndex dans l'ordre original
  for (let i = snapshot.currentIndex; i < snapshot.order.length; i++) {
    const id = snapshot.order[i]
    const idx = filtered.indexOf(id)
    if (idx >= 0) return { order: filtered, index: idx }
  }

  // 3) Premier survivant avant currentIndex
  for (let i = Math.min(snapshot.currentIndex - 1, snapshot.order.length - 1); i >= 0; i--) {
    const id = snapshot.order[i]
    const idx = filtered.indexOf(id)
    if (idx >= 0) return { order: filtered, index: idx }
  }

  return null
}

export function isVideo(photo: PhotoLite | undefined | null): boolean {
  return Boolean(photo?.contentType?.startsWith('video/'))
}

// Classes d'animation CSS définies dans globals.css. Statiques pour que
// Tailwind/PostCSS ne les purge pas (elles sont en CSS pur de toute façon).
export function inAnimationClass(kind: TransitionKind): string {
  return `ba-dia-in-${kind}`
}
export function outAnimationClass(kind: TransitionKind): string {
  return `ba-dia-out-${kind}`
}
