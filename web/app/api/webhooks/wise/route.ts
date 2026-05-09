import { NextResponse, after, type NextRequest } from 'next/server'
import { getServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { getWiseBalance } from '@/lib/wise'
import {
  verifyWiseSignature,
  WISE_EVENT_TYPES,
  type WiseWebhookEvent,
} from '@/lib/wise-webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Webhook Wise — reçoit `transfers#state-change` et `balances#credit`.
 *
 * Contraintes Wise (https://docs.wise.com/guides/developer/webhooks/event-handling) :
 *  - Réponse 2xx attendue en moins de 5 s.
 *  - Retries jusqu'à 25× sur 2 semaines en cas d'échec → idempotence
 *    obligatoire (dédupe sur `X-Delivery-Id`).
 *  - Signature RSA-SHA256 du corps brut dans `X-Signature-SHA256`.
 *
 * Stratégie : on vérifie + dédupe + journalise de manière synchrone, puis on
 * délègue le travail lourd (refresh balance + email organisateurs) à `after()`
 * pour libérer la réponse rapidement.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-signature-sha256')
  const deliveryId = request.headers.get('x-delivery-id')
  const isTestPing = request.headers.get('x-test-notification') === 'true'

  if (!verifyWiseSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  // Test ping envoyé par Wise à la création de la subscription. Le payload
  // n'a pas de structure utile — on accuse réception et on s'arrête là.
  if (isTestPing) {
    return NextResponse.json({ ok: true, test: true })
  }

  let event: WiseWebhookEvent
  try {
    event = JSON.parse(rawBody) as WiseWebhookEvent
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const service = getServiceClient()

  // Idempotence — si on a déjà accusé réception de cette delivery, on ne
  // refait pas le travail. Wise garantit que `X-Delivery-Id` est stable
  // entre les retries d'une même livraison.
  if (deliveryId) {
    const { data: existing } = await service
      .from('audit_log')
      .select('id')
      .eq('event', 'wise.webhook')
      .eq('payload->>delivery_id', deliveryId)
      .limit(1)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true })
    }
  }

  const { error: logError } = await service.from('audit_log').insert({
    event: 'wise.webhook',
    payload: {
      delivery_id: deliveryId,
      event_type: event.event_type,
      schema_version: event.schema_version,
      subscription_id: event.subscription_id,
      sent_at: event.sent_at,
      data: event.data,
    },
  })
  if (logError) {
    // On garde 200 pour éviter une boucle de retries Wise — on a vérifié
    // la signature, donc l'événement est légitime ; un échec DB est notre
    // problème, pas le sien. Le souci sera visible dans les logs Vercel.
    console.error('[wise-webhook] audit insert failed', logError)
  }

  if (event.event_type === WISE_EVENT_TYPES.BALANCE_CREDIT) {
    const amount = event.data.amount ?? 0
    const currency = (event.data.currency ?? 'EUR').toUpperCase()
    const occurredAt = event.data.occurred_at ?? new Date().toISOString()

    after(async () => {
      // 1) Rafraîchir le cache de solde pour que /cagnotte montre le total
      //    à jour dans la foulée.
      const balance = await getWiseBalance()
      if (balance) {
        const { error } = await service.from('cagnotte_balance_cache').upsert({
          id: 1,
          amount_cents: balance.amount_cents,
          currency: balance.currency,
          fetched_at: balance.fetched_at.toISOString(),
        })
        if (error) console.error('[wise-webhook] balance upsert failed', error)
      } else {
        console.warn('[wise-webhook] balance refresh skipped — Wise unavailable')
      }

      // 2) Notifier les organisateurs.
      const organizers = (process.env.ORGANIZER_NOTIFICATION_EMAILS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (organizers.length > 0) {
        const amountStr = amount.toLocaleString('fr-FR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        await sendEmail({
          to: organizers,
          subject: `💸 Cagnotte : +${amountStr} ${currency}`,
          text: [
            `Un dépôt vient d'arriver sur la cagnotte Wise.`,
            ``,
            `Montant : ${amountStr} ${currency}`,
            `Reçu le : ${occurredAt}`,
            balance
              ? `Nouveau solde : ${(balance.amount_cents / 100).toLocaleString(
                  'fr-FR',
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                )} ${balance.currency.toUpperCase()}`
              : `Solde : (rafraîchissement indisponible — sera à jour au prochain cron)`,
          ].join('\n'),
        })
      }
    })
  }

  // `transfers#state-change` : pas d'action — l'audit_log suffit.

  return NextResponse.json({ ok: true })
}
