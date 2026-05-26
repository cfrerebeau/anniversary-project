/**
 * Mapping public bucket key (API contract) → Supabase storage id + size cap.
 * Le bucket id stocké dans `photos.storage_bucket` est celui de Supabase
 * (`photos-souvenirs` / `photos-event`), pas la clé publique.
 */
export const PHOTO_BUCKETS = {
  souvenirs: { id: 'photos-souvenirs', maxBytes: 50 * 1024 * 1024 },
  event: { id: 'photos-event', maxBytes: 100 * 1024 * 1024 },
} as const

export type PhotoBucketKey = keyof typeof PHOTO_BUCKETS

export function bucketKeyFromStorageId(storageId: string): PhotoBucketKey | null {
  for (const key of Object.keys(PHOTO_BUCKETS) as PhotoBucketKey[]) {
    if (PHOTO_BUCKETS[key].id === storageId) return key
  }
  return null
}
