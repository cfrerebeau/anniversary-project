-- ─────────────────────────────────────────────────────────────
-- Admin role pour les organisateurs (Rémy & Christophe)
-- ─────────────────────────────────────────────────────────────
-- Ajoute un flag `is_admin` sur `guests`. Pas de table séparée :
-- les admins sont aussi des guests, ils accèdent à `/admin` en plus.
-- L'app vérifie le flag côté serveur via `requireAdmin()`.
-- ─────────────────────────────────────────────────────────────

alter table public.guests
  add column if not exists is_admin boolean not null default false;

update public.guests
   set is_admin = true
 where email in ('remy.frerebeau@gmail.com', 'cfrerebeau@gmail.com');
