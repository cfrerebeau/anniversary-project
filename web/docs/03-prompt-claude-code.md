# Prompt — Claude Code (plan d'implémentation)

Copier-coller ci-dessous dans une session Claude Code à la racine d'un nouveau repo vide. Claude Code répondra avec un plan d'implémentation détaillé, étape par étape, qu'on validera avant d'écrire du code.

> **Important** : ce prompt demande un *plan*, pas du code. Claude Code doit utiliser ExitPlanMode quand il a fini.

---

## Contexte

**C'est une SURPRISE.** Le site est organisé par les amis de Brice & Alix ; le couple n'est pas au courant et ne doit pas l'être avant le jour du mariage. La préservation de la surprise est un objectif de premier rang qui contraint plusieurs décisions techniques (cf. section "Préservation de la surprise" plus bas).

Audience : ~50–150 invités complices, en français, ouvrent ça sur iPhone à 80 %. Hébergement Vercel. Stack imposée : Next.js 15 (App Router, Server Actions, RSC, React 19). Pas de monorepo — un seul repo Next.js.

## Préservation de la surprise (contraintes techniques)

1. **`noindex, nofollow`** dans les meta tags de toutes les pages, plus `robots.txt` qui interdit tout. Pas de sitemap public.
2. **Aucune page publique sauf `/access`**. Toutes les autres routes redirigent vers `/access` si pas de session active. Y compris `/`.
3. **`/access` ne révèle rien** : pas de noms, pas de date, pas de photo. Titre HTML générique ("Surprise" ou "Petit projet"). Le formulaire dit juste "Saisis ton email pour recevoir le lien".
4. **Réponse identique** sur `/access` que l'email match un guest, ne match pas, ou match un guest blocké : "Si ton email est dans la liste, tu vas recevoir un lien d'ici quelques minutes." Aucun signal qui permette à un attaquant (ou aux mariés) de distinguer les trois cas.
5. **Blocklist** : la table `guests` a une colonne `is_blocked`. Brice et Alix sont seedés avec `is_blocked=true`. La logique `/access` ignore silencieusement ces emails (pas de génération de lien, pas d'envoi d'email).
6. **Tous les emails sortants** (Resend) ont en pied : "🤫 Brice & Alix ne savent pas qu'on prépare ça — garde le secret."
7. **Footer du site** sur chaque page authentifiée : "🤫 On garde ça entre nous."
8. **Pas de meta OpenGraph qui mentionne Brice ou Alix.** Les meta restent génériques.
9. **Pas de boutons de partage social.**

Trois flows :
1. **Cagnotte** — page affichant IBAN/BIC/référence d'un **compte Wise EUR dédié** + bouton "Copier l'IBAN" + lien Lydia secondaire optionnel + total cumulé live (lu via API Wise) + formulaire optionnel "Laisse-nous un mot" (prénom + montant déclaré + message). Aucun paiement traité par le site.
2. **Photos souvenirs** — collectées **avant le jour J**. Page "Partage un souvenir". Drag & drop multi-fichiers, **upload direct client → Supabase Storage** via `createSignedUploadUrl` (le client PUT directement vers le bucket avec le token signé, le serveur ne voit jamais le fichier brut). Une edge function ou route handler post-upload redimensionne à max 2000px côté long et écrit la version optimisée, supprime l'original, écrit la metadata en base. Pas d'affichage public. Légende fortement encouragée (placeholder : "Quand ? Où ? C'était quoi ?"). Fenêtre d'upload : ouverture immédiate, fermeture J−7.
3. **Quizz** — formulaire structuré (prénom optionnel, énoncé de la question, 2 à 4 options de réponse, marquage de la bonne réponse). Server Action, écriture directe en base.

**Authentification : liens magiques par invité, hybride Supabase + Resend.** Brice & Alix fournissent une liste d'emails. Pour chaque guest, on appelle `supabase.auth.admin.generateLink({ type: 'magiclink', email })` côté serveur, on récupère l'URL générée, et on l'envoie via Resend dans un email personnalisé sur-mesure (pas le template Supabase par défaut). Le clic crée une session Supabase. Server-side, on lit l'identité avec `supabase.auth.getUser()` dans les Server Components. Page `/access` pour redemander un lien si perdu (server action qui re-déclenche `generateLink` + Resend).

**Pas d'interface admin custom en v1.** Brice & Alix consultent les soumissions via :
- Supabase Studio (DB browser hébergé) — accès direct aux tables `cagnotte_messages`, `quizz`, `photos`
- digest email quotidien (cron Vercel + Resend)

> Ne pas figer un montant cible pour la cagnotte ni l'usage final des photos. Le code reste générique sur ces deux points.

## Stack imposée (ne pas substituer sans justifier)

- **Next.js 15** App Router, TypeScript strict
- **Vercel** pour l'hébergement (production + previews)
- **Supabase** (free tier) pour Postgres + Auth — drivers `@supabase/supabase-js` (client) et `@supabase/ssr` (helpers Next.js App Router). Migrations en SQL brut dans `/supabase/migrations/*.sql`. Pas de Drizzle, pas de Prisma — requêtes directes avec le client Supabase. Côté serveur on utilise EXCLUSIVEMENT la `service_role_key` (jamais la `anon_key`) ; pas de RLS à configurer.
- **Supabase Storage** pour les photos (free tier 1 GB). Bucket privé, upload client via `createSignedUploadUrl`. Redimensionnement post-upload via `sharp` dans une route handler côté serveur (max 2000px, JPEG quality 85). Originals supprimés après processing.
- **Wise API** pour la cagnotte — uniquement l'endpoint `GET /v4/profiles/{id}/balances` (pas de SCA en v1). Polling toutes les 15 min via cron Vercel, valeur cachée dans la table `cagnotte_balance_cache`.
- **Resend** pour les emails transactionnels (lien magique, digest quotidien, confirmation contribution)
- **Upstash Redis** (via Vercel Marketplace) pour rate limiting — `@upstash/ratelimit` + `@upstash/redis`
- **Tailwind CSS** + **shadcn/ui**
- **react-hook-form** + **Zod** pour formulaires et validation
- **next-safe-action** pour wrapper les Server Actions avec validation Zod et gestion d'erreurs

## Pages à implémenter

| Route | Type | Description |
|---|---|---|
| `/` | RSC, gated | Si pas de session → redirect `/access`. Sinon : hero + photo couple + 3 sections CTA + footer "🤫 On garde ça entre nous". |
| `/access` | Server Action | **Seule page publique**, aucun élément qui révèle de qui il s'agit. Form email → si match guest non-blocké, génère lien magique + envoie Resend. Si pas de match OU `is_blocked=true`, **comportement identique côté UI** (même message, même délai). Rate limit strict (5/h/IP). |
| `/cagnotte` | RSC + Client | Bloc IBAN/BIC/référence + bouton copier + lien Lydia + total live + formulaire "laisse un mot". |
| `/photos` | Client, gated | Drag & drop multi-fichiers, upload via Supabase signed URL, traitement post-upload (resize), écriture meta en base via Server Action. |
| `/quizz` | RSC + Client | Formulaire react-hook-form (énoncé + options dynamiques + bonne réponse), Server Action, validation Zod. |
| `/merci` | RSC | Confirmation post-action. Ton tendre, pas transactionnel. Variant via query param (`?from=cagnotte\|photos\|quizz`). |
| `/mentions-legales` | RSC | Texte statique. |
| `/confidentialite` | RSC | Texte statique. |
| `/auth/callback` | Route Handler | Géré par `@supabase/ssr` — consomme le code OAuth/magic link et set la session cookie. |
| `/api/photos/sign-upload` | Route Handler | Génère une `createSignedUploadUrl` Supabase pour le bucket `photos-souvenirs`, valide content-type, retourne l'URL au client. |
| `/api/photos/process` | Route Handler | Reçoit la notification "upload terminé" du client, télécharge l'original depuis le bucket, redimensionne via `sharp`, ré-écrit la version optimisée, supprime l'original, écrit la ligne en base. |
| `/api/cron/sync-wise-balance` | Route Handler | Appelé par Vercel Cron toutes les 15 min. Lit la balance Wise, met à jour `cagnotte_balance_cache`. |
| `/api/cron/daily-digest` | Route Handler | Appelé par Vercel Cron quotidien. Compose et envoie le digest aux mariés. |
| `/api/cron/cleanup` | Route Handler | Cron mensuel. Purge les données > J+180 sauf opt-in. |

## Modèle de données (Supabase Postgres)

> Note : `auth.users` est géré par Supabase Auth (table système). Notre table `guests` la complète avec les infos métier (nom complet, dates de visite, opt-in). Lien par email.

```sql
-- Notre table métier — Supabase Auth gère auth.users séparément
create table guests (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  is_blocked boolean not null default false,   -- TRUE pour Brice et Alix, ignorés par /access
  invited_at timestamptz not null default now(),
  link_sent_at timestamptz,
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_guests_email on guests(email);

-- Seed obligatoire au premier déploiement : insérer brice@... et alix@... avec is_blocked=true
-- (les emails exacts sont fournis par les organisateurs et stockés en migration ou via script de seed).

create table cagnotte_messages (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references guests(id) on delete set null,
  display_name text,
  amount_cents int,
  message text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create table cagnotte_balance_cache (
  id int primary key default 1 check (id = 1),
  amount_cents int not null default 0,
  currency text not null default 'eur',
  fetched_at timestamptz not null default now()
);
insert into cagnotte_balance_cache (id) values (1);

create table quizz (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references guests(id) on delete set null,
  uploader_name text,
  question_text text not null,
  options jsonb not null,                          -- ["A","B","C"] entre 2 et 4 entrées
  correct_index int not null,                      -- index de la bonne réponse dans options
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint quizz_options_is_array
    check (jsonb_typeof(options) = 'array'),
  constraint quizz_options_count
    check (jsonb_array_length(options) between 2 and 4),
  constraint quizz_correct_index_in_range
    check (correct_index >= 0 and correct_index < jsonb_array_length(options))
);
create index idx_quizz_created on quizz(created_at desc);

create table photos (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references guests(id) on delete set null,
  storage_bucket text not null,
  storage_path text not null,
  uploader_name text,
  caption text,
  content_type text,
  size_bytes int,
  ip_hash text,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  ip_hash text,
  guest_id uuid,
  event text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
```

## Variables d'environnement (TOUTES LES SECRETS, AUCUN EN DUR DANS LE CODE)

`.env.example` doit lister exhaustivement, avec un commentaire d'origine pour chaque :

```bash
# Public — visibles côté client
NEXT_PUBLIC_BASE_URL=                       # https://brice-alix.fr en prod
NEXT_PUBLIC_WEDDING_DATE=                   # ISO 8601, ex: 2026-09-12

# Database + Auth (Supabase)
NEXT_PUBLIC_SUPABASE_URL=                   # https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=              # safe to expose, low-privilege
SUPABASE_SERVICE_ROLE_KEY=                  # SECRET — full access, server-only, never exposed to client
DATABASE_URL=                               # connection string Postgres direct (pour le script de migration)

# Cagnotte Wise
WISE_API_TOKEN=                             # token Wise Personal API
WISE_PROFILE_ID=                            # ex: 309451
WISE_BALANCE_ID=                            # id de la balance EUR dédiée
CAGNOTTE_IBAN=                              # IBAN à afficher sur /cagnotte
CAGNOTTE_BIC=                               # BIC associé
CAGNOTTE_RECIPIENT_NAME=                    # nom à afficher sur le bloc IBAN
CAGNOTTE_REFERENCE=                         # référence demandée aux invités, ex: "Cadeau B&A"
CAGNOTTE_LYDIA_URL=                         # optionnel, lien Lydia secondaire

# Email
RESEND_API_KEY=                             # clé API Resend
RESEND_FROM_EMAIL=                          # ex: "Brice & Alix <noreply@brice-alix.fr>"
COUPLE_NOTIFICATION_EMAILS=                 # CSV des emails recevant le digest

# Storage (Supabase)
SUPABASE_PHOTOS_BUCKET=                     # ex: photos-souvenirs (bucket privé)
SUPABASE_PHOTOS_BUCKET_REGION=              # région du bucket si applicable

# Rate limit
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Crypto
IP_HASH_SALT=                               # 32+ bytes random, pour hasher les IPs
SESSION_COOKIE_SECRET=                      # 32+ bytes random, pour signer les cookies session

# Cron
CRON_SECRET=                                # token requis par Vercel Cron pour appeler /api/cron/*
```

**Règles strictes** :
- `.env.local` git-ignoré (déjà par défaut Next.js)
- `.env.example` commit, jamais avec de vraies valeurs
- Tous les secrets sont configurés sur Vercel (Settings → Environment Variables) pour Production, Preview, Development séparément si nécessaire
- Aucun `console.log` ne doit jamais imprimer une variable contenant un secret
- Pas de `process.env.SECRET_KEY` côté client : tout secret est utilisé exclusivement dans Server Actions, Route Handlers, ou code RSC qui ne fuit pas vers le bundle client

## Règles non-négociables

1. **TypeScript strict** (`"strict": true`, pas de `any`).
2. **Validation Zod** à chaque entrée serveur (Server Action, Route Handler, cron).
3. **Magic links via Supabase Auth** : pas de token custom — utiliser `supabase.auth.admin.generateLink({ type: 'magiclink', email })` côté serveur uniquement (avec service_role_key). L'URL retournée est embarquée dans l'email Resend personnalisé. La session est gérée par `@supabase/ssr`.
4. **Cron endpoints** protégés par `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron envoie ce header).
5. **IP toujours hashée** (sha256 avec sel `IP_HASH_SALT`), jamais stockée en clair.
6. **Rate limiting** :
   - `/access` : 5 demandes/h/IP (sinon brute-force d'emails)
   - `/quizz` : 5 envois/h/IP
   - `/photos` upload : 20 uploads/h/IP
   - `/cagnotte` message : 10 messages/h/IP
7. **Pas de cookie banner agressif** — bandeau RGPD discret avec lien vers `/confidentialite`.
8. **Photo upload côté client uniquement** pour la phase d'upload initial (le serveur ne reçoit jamais le fichier brut). Le serveur télécharge ensuite l'original depuis Supabase Storage pour le redimensionner — c'est une lecture serveur de la version stockée, pas un proxying d'upload.
9. **Mobile-first**, WCAG AA sur contraste et touch targets.
10. **Aucune dépendance lourde inutile** — pas de `heic2any`, pas de Framer Motion, pas de Lottie. Animations CSS pures.
11. **Aucune télémétrie tierce** (pas de Google Analytics, pas de Sentry en v1). Vercel Analytics OK.
12. **Tous les secrets en variables d'environnement**. Aucun secret en dur, aucun fichier de config qui contient une valeur sensible.

## Tests

- Tests unitaires (Vitest) pour la couche `lib/` (validators Zod, formatage des montants, hash IP, génération/comparaison de magic tokens, cookie signing).
- Un test E2E (Playwright) pour le happy path "question de quizz sans guest" et "photo upload avec guest".
- Pas de test E2E pour Wise / Vercel Blob en v1 — vérification manuelle.

## Ce que je veux comme plan

Ne commence pas à coder. Produis un plan structuré comme suit :

### 1. Structure de fichiers complète
Arborescence `tree`-style du projet (`app/`, `lib/`, `components/`, `migrations/`, `scripts/`, etc.) avec un commentaire d'une ligne par fichier expliquant son rôle.

### 2. Ordre d'implémentation
Liste numérotée d'étapes. Pour chaque étape :
- Objectif
- Fichiers créés / modifiés
- Comment je vérifie que ça marche (commande, URL à ouvrir, ce que je dois voir)
- Dépendances avec les étapes suivantes

L'ordre doit être tel que **le repo compile et tourne après chaque étape** — pas d'étape qui casse le build.

### 3. Schéma SQL final + migrations
Le SQL complet des migrations, prêt à copier dans `migrations/0001_initial.sql`. Plus le script `scripts/migrate.ts` qui les applique.

### 4. Snippets clés
Pour les 7 endroits techniques où il est facile de se tromper, fournis le code complet et commenté :
- Le Route Handler `/api/photos/sign-upload` (génère `createSignedUploadUrl` Supabase Storage, valide content-type)
- Le Route Handler `/api/photos/process` (télécharge l'original, resize via `sharp`, upload version optimisée, supprime l'original, écrit la ligne photo)
- Le Route Handler `/auth/callback` avec `@supabase/ssr` (consommation du magic link Supabase, redirect home)
- Le **Server Action `/access` avec comportement constant-time** : prend un email, vérifie blocklist + existence dans `guests`, ne révèle JAMAIS si l'email est connu/inconnu/blocké. Génère le lien via `supabase.auth.admin.generateLink` uniquement si guest non-blocké, envoie le mail Resend, et retourne le même message UI dans tous les cas (avec un délai constant pour éviter les timing attacks).
- Le script CLI `scripts/invite-guests.ts` qui : prend un CSV (email, full_name, is_blocked), upsert dans `guests`, appelle `supabase.auth.admin.generateLink` pour les non-blockés, envoie un email Resend personnalisé avec l'URL générée et le pied "🤫 Brice & Alix ne savent pas — garde le secret".
- Le Route Handler `/api/cron/sync-wise-balance` (lit balance Wise, met à jour cache, vérifie CRON_SECRET via `Authorization: Bearer ${CRON_SECRET}`)
- Le helper de rate limiting Upstash réutilisable

### 5. Checklist de déploiement Vercel
Étapes pour déployer :
- Create project, link repo
- Provisionner Supabase (free tier) : créer projet, récupérer `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Configurer les redirect URLs autorisées sur le dashboard (l'URL prod du domaine non-obvious + l'URL Vercel preview). Créer le bucket Storage `photos-souvenirs` (privé, taille fichier max 25 MB).
- Provisionner Upstash Redis (Vercel Marketplace)
- Créer le compte Wise dédié (alias `+mariage`), récupérer profile id, balance id, API token, ajouter en env vars
- Choisir et configurer un **domaine non-obvious** (ne pas utiliser un domaine qui matche les noms du couple en recherche Google) + DNS + DKIM/SPF Resend. Vérifier que le DNS ne révèle pas leurs noms via WHOIS public (privacy par défaut chez la plupart des registrars).
- Déclarer les Vercel Crons dans `vercel.json` (sync-wise-balance toutes les 15 min, daily-digest 1×/jour, cleanup 1×/mois) — le cron sync-wise garde aussi Supabase free tier hors d'auto-pause
- Lancer la première migration via `pnpm migrate`
- Importer la liste des invités via `pnpm tsx scripts/invite-guests.ts guests.csv`
- Test smoke en preview avant promote prod

### 6. Ce qu'on ne fait PAS en v1
Liste explicite des features volontairement coupées (avec justification d'une ligne) : interface admin custom (Supabase Studio suffit), galerie publique des photos, conversion HEIC client, i18n, dark mode, Stripe / Embedded Checkout, statement Wise / SCA, modération photos, RLS Supabase (on n'utilise que service_role côté serveur), Supabase Storage (on utilise Vercel Blob). Cette liste protège contre le scope creep.

### 7. Risques techniques restants
Top 5 endroits où je risque de me planter. Pour chaque risque, comment le détecter tôt.

## Format de sortie

Réponds en français. Termine en appelant ExitPlanMode pour validation. **N'écris pas de code en dehors des snippets de la section 4.**
