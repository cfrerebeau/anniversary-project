# Plan — Site surprise pour Brice & Alix

## Contexte
**C'est une surprise.** Le site est organisé par un groupe d'amis du couple ; **Brice & Alix ne sont pas au courant** et ne doivent pas l'être avant le jour du mariage. Le site sert de QG aux ~50–150 amis et famille pour préparer un cadeau collectif coordonné.

Trois flows pour les invités complices :
1. **Cagnotte** — collecter des contributions pour un cadeau commun. L'argent est encaissé par l'organisateur (Christophe) sur un compte Wise dédié, remis aux mariés le jour J.
2. **Anecdotes** — collecter des histoires drôles que les amis ont du couple. Matière première pour un discours, un quiz, ou une animation le jour de la fête.
3. **Photos souvenirs** — collecter, **avant le jour J**, des photos que les invités ont du couple : voyages communs, soirées passées ensemble, moments mémorables. Matière nostalgique pour un montage / slideshow / album à présenter le jour du mariage. Chaque invité partagera typiquement 1 à 5 photos avec une petite légende ("Été 2019, week-end à Lisbonne").

Hébergement : Vercel. Stack : Next.js. Langue : français.

> **Note** : ne pas figer maintenant le "quoi en faire exactement" pour les photos / anecdotes collectées (slideshow, discours, quiz), ni un montant cible pour la cagnotte. On collecte la matière, les organisateurs décident ensuite.

---

## Préservation de la surprise (objectif de premier rang)

Si le couple tombe sur le site avant la date, la surprise est foutue. Conséquences architecturales :

- **Domaine non-obvious** : pas `brice-alix.fr` ni quoi que ce soit qui matche leur recherche Google sur leurs propres noms. Privilégier un nom abstrait (`amis-de-mariage.com`, `cest-pour-bientot.fr`) ou un sous-domaine privé d'un domaine déjà à l'organisateur (`p.frerebeau.com` par exemple).
- **`noindex` + `nofollow` + robots.txt strict** : aucune page indexée par les moteurs de recherche. Pas de sitemap public.
- **Aucune page publique** : tout est gated derrière le lien magique, y compris la home. Un visiteur sans token voit `/access` uniquement, sans aucun élément qui révèle de qui il s'agit.
- **Aucune mention publique des prénoms du couple** dans les meta tags, le titre HTML, l'OpenGraph. Le `<title>` peut être quelque chose de générique comme "Surprise" ou "Petit projet". Les noms des mariés n'apparaissent qu'après authentification.
- **Blocklist sur les emails du couple** : si quelqu'un saisit `brice@...` ou `alix@...` sur `/access`, le système doit échouer **silencieusement et de manière indistinguable de "email pas dans la liste"** — surtout pas un message qui confirmerait l'existence du site.
- **Tous les emails Resend** rappellent la consigne en pied : "Brice & Alix ne savent pas qu'on prépare ça — garde le secret 🤫".
- **Footer du site** : un rappel discret sur chaque page : "On garde ça entre nous."
- **Pas de partage social, pas de bouton WhatsApp** : pas de signal de viralité qui augmenterait la chance de fuite.
- **Pas de capture d'écran encouragée** : éviter les éléments visuels marquants/mémorisables qui inciteraient quelqu'un à screenshoter et l'envoyer aux mariés sans réfléchir.

---

## v1 — ce qu'on livre

### Pages
- `/` — uniquement accessible avec session active (lien magique consommé). Sinon redirige vers `/access`. Une fois connecté : photo du couple, **un seul CTA dominant** (la cagnotte), photos et anecdotes plus bas, salutation par prénom, formulaires pré-remplis. Footer "🤫 On garde ça entre nous".
- `/access` — **seule page publique**. Aucun élément qui révèle de qui il s'agit (pas de noms, pas de date, pas de photo). Mini-formulaire "envoie-moi mon lien" : email saisi → si match dans la liste invités, envoi du lien ; si pas de match (ou email du couple en blocklist), même message générique de réponse — silencieusement indistinguable des deux côtés ("Si ton email est dans la liste, tu vas recevoir un lien").
- `/cagnotte` — landing page expliquant le geste, photo, montants suggérés (20 / 50 / 100 €) à titre indicatif, **bloc IBAN / BIC / référence** (compte EUR Wise dédié) avec bouton "Copier l'IBAN", lien Lydia secondaire optionnel. Total cumulé affiché en live (polling de la balance Wise via API). Formulaire optionnel "Laisse-nous un mot" (prénom + montant indicatif + message) découplé du paiement — pas de vérification, c'est de la matière pour le mur de messages.
- `/photos` — page "Partage un souvenir avec Brice & Alix". Drag & drop multi-fichiers, upload direct client → Vercel Blob via signed token (`handleUpload`). Nom pré-rempli si lien magique consommé. **Légende fortement encouragée** ("Quand ? Où ? C'était quoi ?") — c'est ce qui rend la photo précieuse pour le couple. Case consentement RGPD obligatoire. Photos fermées à J−7 (laisser le temps de monter quoi que ce soit pour le jour J).
- `/anecdotes` — formulaire : prénom pré-rempli si guest connu, anecdote (texte libre), question de quiz suggérée. Server Action, pas d'API route.
- `/merci` — confirmation post-action. **Pas de page transactionnelle blanche** — un mot manuscrit "merci", une photo du couple qui rit. C'est une lettre d'amour, pas un reçu.
- `/mentions-legales`, `/confidentialite` — obligatoires en France.

**Pas d'interface admin custom en v1.** Brice & Alix consultent les soumissions via :
- Supabase Studio (DB browser hébergé) — accès direct aux tables `cagnotte_messages`, `anecdotes`, `photos`
- digest email quotidien envoyé par Resend (cron Vercel) listant les nouvelles photos / anecdotes / messages
- les photos uploadées ne sont **pas affichées publiquement** sur le site en v1 (pas d'affichage = pas besoin de modération à la volée — la curation se fait offline avant le jour J)

### Stack
- **Framework** : Next.js 15 (App Router, Server Actions, RSC, React 19)
- **Hébergement** : Vercel
- **Base de données + Auth** : Supabase (free tier). Postgres + Supabase Studio (remplace l'interface admin pour Brice & Alix qui peuvent fouiller via la console hébergée) + Supabase Auth pour les liens magiques. Driver `@supabase/supabase-js`. Migrations SQL brutes dans `/supabase/migrations`. Free tier auto-pause après 7 jours d'inactivité — neutralisé par le cron sync-wise-balance qui tourne toutes les 15 min pendant la fenêtre active.
- **Cagnotte v1** : compte EUR Wise dédié (alias Gmail `+mariage`, isolation totale du compte principal). Pas de processing côté site — les invités font un virement SEPA. La page affiche IBAN + BIC + référence à utiliser. Total live calculé en lisant la balance Wise via leur API (`GET /v4/profiles/{id}/balances`) — endpoint qui ne nécessite pas de SCA. Cron Vercel toutes les 15 min met à jour la valeur cachée en base. Statement endpoint (transactions individuelles) volontairement reporté en v2 si besoin de réconciliation par contributeur.
- **Stockage photos** : Supabase Storage (free tier = 1 GB total). Upload direct client via signed URL (Supabase générère une `createSignedUploadUrl`, le client PUT directement vers le bucket). Pour rester sous 1 GB : redimensionnement côté serveur à 2000px max sur le côté long avant write final, via une edge function qui consomme l'upload original puis ré-écrit la version optimisée. Originals supprimés. Image transformations Supabase utilisables pour servir des thumbnails.
- **Email** : Resend (confirmation contribution, notification admin sur nouvelle anecdote / photo)
- **Rate limit** : Upstash Redis via Vercel Marketplace (5 anecdotes / heure / IP, 20 photos / heure / IP)
- **UI** : Tailwind + shadcn/ui
- **Validation** : react-hook-form + Zod
- **i18n** : aucune lib, copy en français en dur

### Modèle de données (Supabase Postgres)
```
guests (
  id uuid pk,
  email text unique not null,
  full_name text,
  is_blocked boolean default false,        -- TRUE pour Brice et Alix : aucun lien généré
  invited_at timestamptz default now(),
  link_sent_at timestamptz,                -- quand on a envoyé le mail Resend
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  notes text,                              -- champ libre pour les organisateurs dans Studio
  created_at timestamptz default now()
)
-- Note 1 : les tokens magic-link sont gérés par Supabase Auth (auth.users),
-- pas par cette table. Le lien métier = email.
-- Note 2 : seed la table avec brice@... et alix@... avec is_blocked=true, pour
-- garantir que tout email entrant matchant un blocked guest échoue silencieusement.

cagnotte_messages (
  id uuid pk,
  guest_id uuid references guests(id),  -- nullable, anonyme possible
  display_name text,                     -- prénom affiché (pré-rempli si guest)
  amount_cents int,                      -- DÉCLARÉ par l'invité, non vérifié
  message text,
  ip_hash text,
  created_at timestamptz default now()
)

cagnotte_balance_cache (
  id int pk default 1 check (id = 1),    -- ligne unique singleton
  amount_cents int not null default 0,
  currency text not null default 'eur',
  fetched_at timestamptz not null
)

anecdotes (
  id uuid pk,
  guest_id uuid references guests(id),
  uploader_name text,
  story text not null,
  quiz_question text,
  ip_hash text,
  created_at timestamptz default now()
)

photos (
  id uuid pk,
  guest_id uuid references guests(id),
  storage_bucket text not null,            -- ex: 'photos-souvenirs'
  storage_path text not null,              -- chemin dans le bucket
  uploader_name text,
  caption text,
  content_type text,
  size_bytes int,
  ip_hash text,
  created_at timestamptz default now()
)

audit_log (
  id uuid pk,
  ip_hash text,
  guest_id uuid,
  event text,
  payload jsonb,
  created_at timestamptz default now()
)
```

### Décisions clés
1. **Cagnotte = compte Wise EUR dédié** (créé sous un alias Gmail `+mariage` pour isolation totale). Aucun processing de paiement côté site. Page affiche IBAN + BIC + référence, total live polled depuis l'API Wise. Endpoint `balances` ne nécessite pas de SCA — pas de gestion de clés RSA en v1. Reconciliation par contributeur reportée en v2 (statement endpoint avec SCA si nécessaire).
2. **Supabase** sur free tier. Postgres + Auth + Studio (qui sert d'interface admin "gratuite" pour Brice & Alix). Pause automatique après 7 jours évitée par le cron Wise (15 min) qui maintient le projet actif.
3. **Liens magiques par invité** : Supabase Auth `admin.generateLink` génère le token, Resend envoie un email personnalisé sur-mesure (pas le template Supabase par défaut). L'invité clique → session Supabase → site personnalisé. Page `/access` permet de redemander un lien.
4. **Pas d'interface admin custom en v1**. Brice & Alix consultent via Supabase Studio (DB browser hébergé) + digest email quotidien (cron Vercel + Resend).
5. **Photos en v1**, pas affichées publiquement. Collectées et stockées, point. Pas d'affichage = pas besoin de modération. JPEG/PNG/HEIC tous acceptés, conversion éventuelle traitée côté serveur en v2.
6. **Tous les secrets en variables d'environnement** sur Vercel. Aucun secret en dur dans le code, aucun secret commit, `.env.local` git-ignoré, `.env.example` documenté.

### Cycle de vie
- Cagnotte : ouverte jusqu'à J+7
- Anecdotes : fermées à J−3 (pour permettre la construction du quiz si quiz il y a)
- Photos souvenirs : ouvertes jusqu'à J−7 (laisser le temps aux mariés de monter un slideshow / album / film pour le jour J)
- Données : supprimées à J+180 sauf demande explicite des mariés de conserver

### RGPD
- Consentement explicite sur le formulaire d'anecdotes (case à cocher)
- IP hashées (sha256 + sel), jamais stockées en clair
- Page `/confidentialite` listant les données collectées et la durée
- Endpoint de demande de suppression (email)

---

## Questions à poser à Brice & Alix avant de coder

1. **Photo du couple disponible pour la home** ? Charte visuelle (couleurs, typo, faire-part existant) à respecter ?
2. **Liste des invités** : email + prénom dans un CSV, prêt à importer pour générer les liens magiques ?
3. **Que veulent-ils faire des photos souvenirs collectées** : montage vidéo, slideshow, album imprimé ? La réponse n'affecte pas la v1 du site mais informe la communication faite aux invités ("partage des photos pour notre slideshow").

> Note : on ne fige pas un montant cible pour la cagnotte. Décision plus tard.

---

## Risques identifiés (passage en revue Devil's Advocate)

| Risque | Mitigation |
|---|---|
| Lien magique fuit, accès non invité | Token long (32 bytes random), pas de gate-keeping critique (le site reçoit, ne distribue pas), rate limit sur `/access` |
| URL ou photo fuite, contenu inapproprié | Aucune galerie publique en v1, photos jamais affichées → fuite sans conséquence |
| Compte Wise EUR principal (non dédié) reçoit autre chose qu'une cagnotte pendant la fenêtre | Compte EUR Wise SECOND, isolé par alias `+mariage`, jamais utilisé pour autre chose |
| Limite SEPA inbound Wise dépassée | À €1000 max, très en-deçà des seuils Wise tier de base |
| Spam sur les anecdotes / photos / messages | Rate limit Upstash + honeypot + lien magique (l'identité guest filtre 99 % du spam) |
| Pas de plan post-mariage | Cycle de vie défini ci-dessus, suppression J+180, cron Vercel scheduled-task pour la purge |
| Email magic link ne se rend pas | DKIM/SPF correctement configurés sur le domaine, page `/access` permet de redemander |
