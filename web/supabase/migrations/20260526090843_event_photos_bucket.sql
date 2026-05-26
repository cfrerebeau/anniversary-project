-- ─────────────────────────────────────────────────────────────
-- Bucket photos-event + index pour /photos par bucket
-- ─────────────────────────────────────────────────────────────
-- Post-mariage : nouveau bucket pour les photos de la fête (cap 100 MB,
-- supérieur au bucket "souvenirs" 50 MB pour absorber des vidéos plus longues).
-- Pas de RLS Storage : l'app accède via service_role côté serveur uniquement
-- (cf. convention du 20260509000001_initial.sql).
--
-- Comportement intentionnellement idempotent : re-rouler la migration
-- enforce la config (taille / MIME) en cas de drift manuel via le studio.
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos-event',
  'photos-event',
  false,
  104857600, -- 100 MB
  array[
    'image/jpeg','image/png','image/heic','image/heif','image/webp',
    'video/mp4','video/quicktime','video/webm'
  ]
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Index pour /photos qui filtre par storage_bucket (et /cadeau qui parcourt
-- chaque bucket à la suite). L'index `idx_photos_created` existant ne couvre
-- pas le prédicat de bucket et force un scan séquentiel post-filtre.
create index if not exists idx_photos_bucket_created
  on public.photos (storage_bucket, created_at desc);

-- Unicité (bucket, path) : empêche le replay du même /process avec un nonce
-- HMAC encore valide (10 min TTL) d'insérer plusieurs rows pour le même
-- objet storage (cas typique : vidéos qui ne passent pas par sharp et donc
-- ne suppriment pas l'original).
create unique index if not exists idx_photos_storage_unique
  on public.photos (storage_bucket, storage_path);
