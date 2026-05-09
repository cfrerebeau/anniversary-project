# Prompt — Claude (design)

Copier-coller ci-dessous dans une conversation neuve avec Claude pour obtenir la direction visuelle du site mariage de Brice & Alix.

---

## Brief

Tu es designer pour un site web qui sert de QG à un groupe d'amis qui préparent un cadeau collectif **en surprise** pour le mariage de Brice & Alix. **Le couple n'est pas au courant** et ne doit pas l'être avant le jour J. Site en français, hébergé sur Vercel, construit en Next.js. Public : famille et amis complices, âges 20–80, à l'aise avec smartphone mais pas tech.

Trois flows sur le site, dans cet ordre de priorité visuelle :
1. **Cagnotte** — afficher IBAN/BIC/référence d'un compte EUR Wise dédié + bouton "Copier l'IBAN" + lien Lydia secondaire optionnel + total cumulé live + petit formulaire "laisse-nous un mot" (prénom, montant déclaré, message).
2. **Photos souvenirs** — collecter, **avant le mariage**, des photos que les invités ont du couple (voyages, soirées, moments mémorables passés ensemble). Drag & drop multi-fichiers, upload direct vers Vercel Blob, jamais affichées publiquement. La page doit donner envie de fouiller dans son téléphone et trouver de vieux souvenirs partagés avec Brice & Alix. Légende fortement encouragée ("Quand ? Où ?").
3. **Anecdotes** — collecter des histoires drôles (probablement pour un quiz, usage final flexible)

**Authentification : liens magiques par invité.** Chaque invité reçoit un email personnalisé avec un lien unique. Au clic : session active, salutation par prénom, formulaires pré-remplis. Page `/access` permet de redemander son lien si perdu.

> Ne pas chercher à figer l'usage final des photos ni un montant cible pour la cagnotte. On collecte la matière, on décidera ensuite. Le design doit donc rester ouvert et générique sur ces deux points.

## Ton et intention

Ce site est un **cabanon de complices**, pas un site mariage public.
- Chaleureux, intime, joyeux, **conspirateur** ("psst, on prépare un truc…")
- Pas de jargon, pas de "checkout", pas de "submit"
- Une voix qui sonne comme un copain du couple qui chuchote, pas comme un onboarding SaaS
- Évite tout ce qui ressemble à une plateforme générique de mariage type "Mariages.net"
- Petit clin d'œil discret au secret partout : un emoji 🤫 dans le footer, une signature "🤫 entre nous" en pied d'email, etc. Subtil, pas envahissant.

**Contrainte de sécurité narrative** : la page `/access` (la seule visible sans authentification) doit être **complètement opaque**. Aucun élément qui révèle qu'il s'agit du mariage de Brice & Alix : pas de noms, pas de date, pas de photo, pas de palette de couleurs reconnaissable. Si Brice ou Alix tombent dessus par accident, ils doivent voir une page neutre type "Petit projet privé — saisis ton email".

## Principes UX (à respecter sans exception)

1. **Lien magique par invité, envoyé par email.** Friction nulle pour l'invité (un clic = il est connecté). Mais accès strictement gated : sans token valide, seule `/access` est accessible, et `/access` ne révèle rien. Préservation de la surprise > UX confort.
2. **Un seul CTA dominant** sur la home (post-auth) — la cagnotte. Les anecdotes et photos sont en second, plus bas dans la page, traitées avec un ton plus léger.
3. **Mobile-first.** 80 % des invités liront ça sur iPhone, dont une partie a 65+ ans. Boutons larges, typo lisible, contraste élevé.
4. **Le moment de "merci"** doit être tendre, pas transactionnel. Pas de page blanche avec "Merci pour votre paiement". Imagine plutôt : un mot manuscrit "merci", une photo du couple qui rit, une phrase signée Brice & Alix.
5. **Accessibilité WCAG AA** sur les couleurs et les tailles de touch target (44 × 44 px min).

## Livrables attendus

Produis dans l'ordre :

### 1. Direction visuelle (1 page)
- Palette : 4–6 couleurs avec hex et usage (primaire, secondaire, fond, texte, accent, success)
- Typographie : 2 polices max (une pour les titres, une pour le corps), liens Google Fonts ou justification si custom
- Une **moodboard verbale** — 5 références visuelles décrites précisément (pas de liens externes, juste la description : "papeterie de mariage français années 70, bord crème, encre marine, fleurs séchées pressées")
- Le **ton de voix** en 5 lignes avec exemples concrets (titre de page, microcopy d'erreur, signature de l'email de remerciement)

### 2. Wireframes annotés (texte structuré)
Pour chaque page, donne un wireframe en texte structuré avec :
- Hiérarchie visuelle (H1, H2, body, CTA)
- Microcopy en français définitif (pas de placeholder)
- Comportement responsive (mobile vs desktop)
- États (vide, chargement, succès, erreur)

Pages à couvrir :
- `/` (home) — salutation par prénom si guest connu
- `/access` — petit form "renvoie-moi mon lien" si l'invité arrive sans token
- `/cagnotte`
- `/photos` (drag & drop multi-fichiers, prévisualisations, barre de progression, état succès, gestion erreurs upload — fichiers refusés, taille trop grosse, etc.)
- `/anecdotes`
- `/merci` (générique, ré-utilisée par les trois flows mais avec une nuance par flow)
- `/mentions-legales`, `/confidentialite` (juste la structure)

> Pas de page admin custom à designer — Brice & Alix utilisent Supabase Studio (interface hébergée) pour fouiller les soumissions.

### 3. Composants
Liste des composants partagés à construire dans shadcn/ui : Button (variants), Input, Textarea, Card, Toast, etc. Pour chacun, ses variants et ses états.

### 4. Mockup HTML d'une page clé
Pour la **home** uniquement, produis un mockup HTML statique single-file (Tailwind via CDN, pas de framework) que je puisse ouvrir dans un navigateur. Mobile-first. Inclut le vrai français définitif. Pas de Lorem Ipsum.

## Contraintes techniques à respecter

- Tailwind CSS (utilisable via `@apply` ou classes utilitaires)
- shadcn/ui pour les composants interactifs
- Pas d'animations qui ralentissent — préfère des transitions CSS courtes (200–300ms)
- Pas de carrousel sur la home (dégradé pour l'accessibilité et la perf)

## À ne pas faire

- Pas de palette générique "wedding pink + cream"
- Pas de scriptos cursives illisibles
- Pas de gros hero vidéo qui pèse 8 Mo
- Pas de dark mode (inutile ici)
- Pas de cookie banner agressif (privilégier un bandeau discret RGPD-conforme)

## Format de sortie

Réponds en français. Structure ta réponse avec les 4 sections numérotées ci-dessus. Pour la section 4 (mockup HTML), donne un seul fichier `home.html` complet et auto-suffisant.
