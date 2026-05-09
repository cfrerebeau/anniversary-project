# Webhook Wise — `/api/webhooks/wise`

Endpoint qui reçoit en quasi temps réel les événements Wise (dépôts sur le solde, transitions d'état des transferts) et rafraîchit le total `/cagnotte` + notifie les organisateurs par email à chaque dépôt.

## Comportement

| Événement Wise | Action |
|---|---|
| `balances#credit` | Refresh `cagnotte_balance_cache` (via `getWiseBalance()`) + email aux `ORGANIZER_NOTIFICATION_EMAILS`. Le travail est déférré via `after()` pour respecter le SLA Wise (réponse 2xx en < 5 s). |
| `transfers#state-change` | Journalisation dans `audit_log` (event = `wise.webhook`). Pas d'autre action. |
| Test ping (header `X-Test-Notification: true`, envoyé à la création de la subscription) | 200 OK immédiat, sans dédupe ni écriture DB. |

Toute requête est :
1. Vérifiée — signature RSA-SHA256 du corps brut contre la clé publique de prod (`WISE_WEBHOOK_PUBLIC_KEY_PEM`). Échec → `401`.
2. Dédupliquée sur `X-Delivery-Id` (Wise retry jusqu'à 25× sur 2 semaines, l'ID est stable entre retries). On scanne `audit_log` ; si déjà vu, on renvoie `200 { duplicate: true }`.
3. Journalisée dans `audit_log` avec `event='wise.webhook'` et le payload complet en JSONB.

## Configuration

### Variables d'environnement

```env
WISE_WEBHOOK_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

La clé publique de **production** est publiée par Wise sur https://docs.wise.com/guides/developer/webhooks/event-handling. Sur Vercel, coller le PEM tel quel dans la variable d'environnement scope **Production** uniquement.

Variables réutilisées :
- `WISE_API_TOKEN`, `WISE_PROFILE_ID`, `WISE_BALANCE_ID` — déjà utilisées par le cron `sync-wise-balance`, on s'en sert pour le refresh post-dépôt.
- `ORGANIZER_NOTIFICATION_EMAILS` (CSV) — destinataires des emails de dépôt.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — si non renseignés, les emails sont seulement loggés (mode "simulated").

### Souscription côté Wise (à faire une seule fois après déploiement)

1. Wise web app → **Settings → Developer tools → Webhooks → Create subscription**.
2. URL : `https://<prod-domain>/api/webhooks/wise`.
3. Cocher :
   - **Transfer state-change** (`transfers#state-change`)
   - **Account deposit** (`balances#credit`)
4. **Schema version : 4.0.0** (timestamps précision ms).
5. À la sauvegarde, Wise envoie un `POST` de test avec `X-Test-Notification: true`. L'endpoint répond 200 et la subscription passe au vert.

## Vérification end-to-end

```sh
# 1. Type-check + lint + tests
pnpm tsc --noEmit && pnpm lint && pnpm vitest run tests/lib.wise-webhook.test.ts

# 2. Après déploiement prod, vérifier dans Supabase :
select event,
       payload->>'event_type' as type,
       payload->>'delivery_id' as delivery,
       created_at
from audit_log
where event = 'wise.webhook'
order by created_at desc
limit 10;
```

Smoke test réel : envoyer 1 € sur l'IBAN de la cagnotte. Sous ~5 s :
- une nouvelle ligne `audit_log` `wise.webhook` apparaît (`event_type = balances#credit`),
- `cagnotte_balance_cache.amount_cents` est mis à jour,
- un email arrive sur `ORGANIZER_NOTIFICATION_EMAILS`.

Rejouer la même livraison depuis le dashboard Wise doit renvoyer `{ duplicate: true }` et **ne pas** envoyer un second email.
