import Image from 'next/image'
import Link from 'next/link'
import { requireGuest, getFirstName } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { getCagnotteTotalCents } from '@/lib/cagnotte'
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
  const [total, { count }] = await Promise.all([
    getCagnotteTotalCents(),
    service
      .from('cagnotte_messages')
      .select('id', { count: 'exact', head: true }),
  ])

  const contributors = count ?? 0

  const iban = process.env.CAGNOTTE_IBAN ?? ''
  const bic = process.env.CAGNOTTE_BIC ?? ''
  const reference = process.env.CAGNOTTE_REFERENCE ?? 'CADEAU-BA'
  const recipient = process.env.CAGNOTTE_RECIPIENT_NAME ?? ''
  const lydiaUrl = process.env.CAGNOTTE_LYDIA_URL ?? ''
  const whatsappUrl = process.env.NEXT_PUBLIC_WHATSAPP_URL ?? ''

  return (
    <PageContainer width="wide">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/" />
        <BAPageTitle
          eyebrow="01 · cagnotte"
          title="Mettre au pot."
          italicWord="pot"
          sub={
            <>
              <p className="text-ink text-[17px] leading-[1.45] font-medium">
                Brice &amp; Alix partent deux semaines à la Toussaint en famille Marcillac,
                direction Grèce ou côte amalfitaine. Cette cagnotte, c&apos;est notre coup de
                pouce.
              </p>
              <ul className="mt-[12px] space-y-[6px] text-[15px] leading-[1.45] list-disc pl-[18px] marker:text-ink-mute">
                <li>
                  Compte Wise dédié{recipient ? ` au nom de ${recipient}` : ''} pour éviter les
                  frais. Pas de pression sur le montant.
                </li>
                <li>
                  On décide ensemble sur WhatsApp ce qu&apos;on en fait avant la fête : leur
                  remettre la somme telle quelle ou converger sur une idée plus précise.
                </li>
              </ul>
            </>
          }
        />

        {/* Mobile = pile, Desktop = 2 colonnes (coordonnées à gauche / formulaire à droite) */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">
          {/* Colonne gauche : total + IBAN + Lydia */}
          <div>
            <div className="px-[22px]">
              <TotalCard totalCents={total} contributorsCount={contributors} />
            </div>

            <div className="px-[22px] pt-[18px]">
              <IbanCard iban={iban} bic={bic} reference={reference} beneficiary={recipient} />
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

            {whatsappUrl && (
              <div className="px-[22px] pt-[14px]">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="ba-btn w-full bg-transparent border border-paper-edge rounded-[14px] py-[14px] px-[16px] flex items-center gap-[12px] text-ink"
                >
                  <div
                    className="shrink-0 relative"
                    style={{ width: 32, height: 32 }}
                    aria-hidden
                  >
                    <Image
                      src="/whatsapp.png"
                      alt=""
                      fill
                      sizes="32px"
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] font-medium">Discuter des idées cadeau</div>
                    <div className="text-[12px] text-ink-soft">
                      Groupe WhatsApp — entre complices
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
            retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </PageContainer>
  )
}

function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//, '')
}
