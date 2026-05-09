import Link from 'next/link'
import { requireGuest, getFirstName } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { IconArrow } from '@/components/design/icons'
import { TotalCard } from '@/components/cagnotte/total-card'
import { IbanCard } from '@/components/cagnotte/iban-card'
import { MessageForm } from '@/components/cagnotte/message-form'

export const dynamic = 'force-dynamic'

export default async function CagnottePage() {
  const guest = await requireGuest()
  const firstName = getFirstName(guest)

  const service = getServiceClient()
  const [{ data: cache }, { count }] = await Promise.all([
    service.from('cagnotte_balance_cache').select('amount_cents').eq('id', 1).single(),
    service
      .from('cagnotte_messages')
      .select('id', { count: 'exact', head: true }),
  ])

  const total = cache?.amount_cents ?? 0
  const contributors = count ?? 0

  const iban = process.env.CAGNOTTE_IBAN ?? ''
  const bic = process.env.CAGNOTTE_BIC ?? ''
  const reference = process.env.CAGNOTTE_REFERENCE ?? 'CADEAU-BA'
  const recipient = process.env.CAGNOTTE_RECIPIENT_NAME ?? ''
  const lydiaUrl = process.env.CAGNOTTE_LYDIA_URL ?? ''

  return (
    <PageContainer width="wide">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/" />
        <BAPageTitle
          eyebrow="01 · cagnotte"
          title="Mettre au pot."
          italicWord="pot"
          sub={`Brice & Alix partent deux semaines à la Toussaint — Grèce ou côte amalfitaine, en famille Marcillac. Cette cagnotte, c'est notre coup de pouce. Compte Wise dédié${recipient ? `, ouvert au nom de ${recipient}` : ''}, total tenu à jour ici. Vire ce que tu veux, sans pression.`}
        />

        {/* Mobile = pile, Desktop = 2 colonnes (coordonnées à gauche / formulaire à droite) */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">
          {/* Colonne gauche : total + IBAN + Lydia */}
          <div>
            <div className="px-[22px]">
              <TotalCard totalCents={total} contributorsCount={contributors} />
            </div>

            <div className="px-[22px] pt-[18px]">
              <IbanCard iban={iban} bic={bic} reference={reference} />
            </div>

            {lydiaUrl && (
              <div className="px-[22px] pt-[14px]">
                <a
                  href={lydiaUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="ba-btn w-full bg-transparent border border-paper-edge rounded-[14px] py-[14px] px-[16px] flex items-center gap-[12px] text-ink"
                >
                  <div
                    className="rounded-[8px] bg-olive text-paper flex items-center justify-center font-bold"
                    style={{ width: 32, height: 32, fontSize: 13 }}
                    aria-hidden
                  >
                    L
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] font-medium">Plutôt Lydia ?</div>
                    <div className="text-[12px] text-ink-soft">
                      {stripProtocol(lydiaUrl)} — secondaire
                    </div>
                  </div>
                  <IconArrow size={16} className="text-ink-mute" />
                </a>
              </div>
            )}
          </div>

          {/* Colonne droite : formulaire (sticky en desktop) */}
          <div className="lg:sticky lg:top-[20px]">
            <div className="px-[22px] pt-[24px] lg:pt-0">
              <MessageForm defaultName={firstName} />
            </div>
          </div>
        </div>

        <div className="h-[40px]" />
        <div className="text-center pb-[20px]">
          <Link
            href="/"
            className="ba-btn bg-transparent text-ink-soft text-[13px] underline underline-offset-[3px] p-[6px]"
          >
            retour au cabanon
          </Link>
        </div>
      </div>
    </PageContainer>
  )
}

function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//, '')
}
