-- ─────────────────────────────────────────────────────────────
-- Cabanon de complices — schéma initial
-- ─────────────────────────────────────────────────────────────
-- Conventions :
--   • Pas de RLS — l'app accède uniquement via service_role côté serveur.
--   • Magic-link tokens gérés par Supabase Auth (auth.users) ;
--     notre table guests est métier (lien par email, infos invité).
-- ─────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- ── Invités ─────────────────────────────────────────────────
create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  is_blocked boolean not null default false,    -- TRUE pour Brice & Alix : ignorés silencieusement par /access
  invited_at timestamptz not null default now(),
  link_sent_at timestamptz,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_guests_email on public.guests(email);

-- ── Cagnotte — messages "laisse un mot" ─────────────────────
create table if not exists public.cagnotte_messages (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references public.guests(id) on delete set null,
  display_name text,
  amount_cents int,
  message text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists idx_cagnotte_messages_created on public.cagnotte_messages(created_at desc);

-- ── Cagnotte — cache du total (mis à jour par le cron Wise toutes les 15 min) ──
create table if not exists public.cagnotte_balance_cache (
  id int primary key default 1 check (id = 1),
  amount_cents int not null default 0,
  currency text not null default 'eur',
  fetched_at timestamptz not null default now()
);
insert into public.cagnotte_balance_cache (id) values (1) on conflict (id) do nothing;

-- ── Anecdotes ───────────────────────────────────────────────
create table if not exists public.anecdotes (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references public.guests(id) on delete set null,
  uploader_name text,
  title text,
  story text not null,
  since_relationship text,                       -- "<1 an" | "1-5 ans" | "5-15 ans" | "la vie"
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists idx_anecdotes_created on public.anecdotes(created_at desc);

-- ── Photos souvenirs ────────────────────────────────────────
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references public.guests(id) on delete set null,
  storage_bucket text not null,
  storage_path text not null,
  uploader_name text,
  caption text,
  content_type text,
  size_bytes int,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists idx_photos_created on public.photos(created_at desc);

-- ── Audit log ───────────────────────────────────────────────
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  ip_hash text,
  guest_id uuid,
  event text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_log(created_at desc);

-- ── Rate limiting (Postgres-backed sliding window, remplace Upstash) ──
create table if not exists public.rate_limit_events (
  id bigserial primary key,
  bucket text not null,                          -- ex: "access:hash(ip)" ou "anecdote:hash(ip)"
  occurred_at timestamptz not null default now()
);
create index if not exists idx_rate_limit_bucket_time
  on public.rate_limit_events(bucket, occurred_at desc);

-- ── Storage : bucket photos-souvenirs (privé) ───────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos-souvenirs',
  'photos-souvenirs',
  false,
  52428800,                                      -- 50 MB par fichier
  array[
    'image/jpeg','image/png','image/heic','image/heif','image/webp',
    'video/mp4','video/quicktime','video/webm'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
