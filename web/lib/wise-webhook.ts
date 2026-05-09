import { verify } from 'node:crypto'

/**
 * Vérifie la signature RSA-SHA256 d'un webhook Wise.
 *
 * Wise signe le corps brut de la requête avec sa clé privée et envoie la
 * signature en Base64 dans `X-Signature-SHA256`. La clé publique de
 * production est publiée dans la doc Wise et stockée ici en variable
 * d'environnement (`WISE_WEBHOOK_PUBLIC_KEY_PEM`) pour pouvoir la roter
 * sans redéploiement.
 *
 * Référence : https://docs.wise.com/guides/developer/webhooks/event-handling
 */
export function verifyWiseSignature(
  rawBody: string | Buffer,
  signatureB64: string | null | undefined,
  publicKeyPem: string | undefined = process.env.WISE_WEBHOOK_PUBLIC_KEY_PEM,
): boolean {
  if (!signatureB64 || !publicKeyPem) return false

  let signature: Buffer
  try {
    signature = Buffer.from(signatureB64, 'base64')
  } catch {
    return false
  }
  if (signature.length === 0) return false

  const data = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody

  try {
    return verify('RSA-SHA256', data, publicKeyPem, signature)
  } catch {
    return false
  }
}

export const WISE_EVENT_TYPES = {
  TRANSFER_STATE_CHANGE: 'transfers#state-change',
  BALANCE_CREDIT: 'balances#credit',
} as const

export type WiseEventType =
  (typeof WISE_EVENT_TYPES)[keyof typeof WISE_EVENT_TYPES]

/**
 * Forme générique d'un payload de webhook Wise (schema_version 4.0.0).
 * Champs strictement utilisés ici ; le reste reste dans `data.resource` /
 * `data` et est journalisé tel quel.
 */
export type WiseWebhookEvent = {
  event_type: string
  schema_version?: string
  subscription_id?: string
  sent_at?: string
  data: {
    resource?: {
      type?: string
      id?: number | string
      profile_id?: number | string
      account_id?: number | string
    }
    transaction_type?: 'credit' | 'debit'
    amount?: number
    currency?: string
    post_transaction_balance_amount?: number
    current_state?: string
    previous_state?: string | null
    occurred_at?: string
  }
}
