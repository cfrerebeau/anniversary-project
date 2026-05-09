-- ─────────────────────────────────────────────────────────────
-- Renomme `anecdotes` (collecte d'anecdotes libre) en `quizz`
-- (questions de quiz pour le jour J).
-- ─────────────────────────────────────────────────────────────
-- Le formulaire /quizz collecte des questions { énoncé + 2 à 4
-- options + bonne réponse }. Les éventuelles données précédentes
-- de la table anecdotes sont droppées (décision explicite :
-- « repartir de zéro »).
-- ─────────────────────────────────────────────────────────────

drop table if exists public.anecdotes;

create table public.quizz (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references public.guests(id) on delete set null,
  uploader_name text,
  question_text text not null,
  options jsonb not null,                          -- text[] sérialisé : ["A","B","C"]
  correct_index int not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint quizz_options_is_array
    check (jsonb_typeof(options) = 'array'),
  constraint quizz_options_count
    check (jsonb_array_length(options) between 2 and 4),
  constraint quizz_correct_index_in_range
    check (correct_index >= 0 and correct_index < jsonb_array_length(options))
);
create index idx_quizz_created on public.quizz(created_at desc);
