<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Post-mariage — surfaces ajoutées (2026-05-26)

- `/cadeau` : page bénéficiaires (Brice & Alix) + admins. Auth via cookie `cadeau_auth` posé par la query `?token=<64-hex>` (env `BENEFICIARY_ACCESS_TOKEN`), OU session admin. La page est `robots: noindex` et `Referrer-Policy: no-referrer`. Token rotation : changer l'env var sur Vercel ; le cookie reste valide 30 j côté navigateurs (à documenter aux destinataires si rotation forcée).
- `/photos` : deux onglets `souvenirs` (bucket `photos-souvenirs`, 50 MB/file) et `event` (bucket `photos-event`, 100 MB/file). Deep-link `?tab=event`. La galerie est collective (tous voient tout) ; les mutations (delete, edit caption) restent owner-scoped via `eq('guest_id', guest.id)` dans `/api/photos/delete` et `/api/photos/update-caption`.
- Upload binding : `/api/photos/sign-upload` émet un HMAC nonce (`SESSION_COOKIE_SECRET`) qui binde `(guest_id, bucket, path)` ; `/api/photos/process` le vérifie + HEAD-check l'objet dans le bucket annoncé pour empêcher la falsification.
- ZIP streaming : helper partagé `lib/zip-photos.ts` (PassThrough + `events.once` + `archive.finalize`). Routes `GET /api/photos/download-all?bucket=…` (guest auth + RL 5/h) et `GET /api/cadeau/download-all` (cadeau auth + RL 5/h). Budget pre-flight 5 GB / 8 GB respectivement → 413 si dépassé.
- Invitations : `lib/invite.ts` lit l'expiry depuis `INVITE_EXPIRES_AT` (ISO 8601) avec fallback `2026-08-31T23:59:59+02:00`. Le slug exposé sur `/cadeau` via la carte `InviteShareCard` est `GLOBAL_INVITE_SLUG` — secret faible déjà connu des invités originaux.
