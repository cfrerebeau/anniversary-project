import Image from 'next/image'
import Link from 'next/link'
import { requireGuest, getFirstName } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { BACard } from '@/components/design/card'
import { BAFooter } from '@/components/design/footer'
import { PageContainer } from '@/components/design/page-container'
import { IconArrow } from '@/components/design/icons'
import { formatEUR, daysUntil } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const guest = await requireGuest()
  const firstName = getFirstName(guest)

  const weddingISO = process.env.NEXT_PUBLIC_WEDDING_DATE ?? '2026-09-12'
  const dLeft = daysUntil(weddingISO)

  const service = getServiceClient()
  const { data: cache } = await service
    .from('cagnotte_balance_cache')
    .select('amount_cents')
    .eq('id', 1)
    .single()
  const total = cache?.amount_cents ?? 0
  const whatsappUrl = process.env.NEXT_PUBLIC_WHATSAPP_URL ?? ''

  return (
    <PageContainer width="wide">
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="px-[22px] pt-[54px] pb-[14px] flex justify-between items-center">
        <div className="font-mono text-[11px] text-stamp tracking-[0.18em] uppercase">
          🤫 entre nous
        </div>
        <div className="font-mono text-[11px] text-ink-mute tracking-[0.12em] uppercase">
          j-{dLeft}
        </div>
      </div>

      {/* Layout responsive : mobile = pile, desktop = 2 colonnes (hero+photo / CTA+cards) */}
      <div className="lg:grid lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:items-start">
      <div>
      {/* Hero */}
      <div className="px-[22px] pt-[6px] pb-[4px]">
        <h1 className="font-serif text-[44px] leading-[1.02] tracking-[-0.015em] m-0 lg:text-[72px] lg:leading-[0.98]">
          Coucou <em className="italic">{firstName}</em>.
        </h1>
        <p
          className="mt-[14px] text-ink-soft text-[17px] leading-[1.5] lg:text-[19px] lg:max-w-[520px]"
          style={{ textWrap: 'pretty' }}
        >
          On prépare quelque chose pour <span className="ba-pen">Brice &amp; Alix</span>. Un cadeau
          collectif, en douce. T&apos;en es.
        </p>
      </div>

      {/* Photo couple — discrète, post-auth uniquement */}
      <div className="px-[22px] pt-[18px] pb-[6px]">
        <BACard className="overflow-hidden p-0">
          <div className="relative w-full" style={{ aspectRatio: '4 / 3' }}>
            <Image
              src="/couple.jpg"
              alt="Brice & Alix"
              fill
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 60vw, 720px"
              style={{ objectFit: 'cover' }}
            />
          </div>
        </BACard>
      </div>
      </div>

      <div>
      {/* CTA primaire — cagnotte */}
      <div className="px-[22px] pt-[20px] pb-[8px] lg:pt-[6px]">
        <Link
          href="/cagnotte"
          className="ba-btn block w-full text-left bg-ink text-paper rounded-[22px] p-[22px] relative overflow-hidden"
          style={{ boxShadow: '0 18px 36px -22px rgba(21,35,59,.7)' }}
        >
          <div
            className="absolute"
            style={{ top: 14, right: 14, transform: 'rotate(8deg)' }}
            aria-hidden
          >
            <span
              className="ba-rubber"
              style={{
                color: 'rgba(244,237,224,.55)',
                fontSize: 9,
                borderColor: 'rgba(244,237,224,.4)',
              }}
            >
              Cagnotte · 01
            </span>
          </div>
          <div
            className="font-mono text-[11px] tracking-[0.18em] uppercase"
            style={{ color: 'rgba(244,237,224,.55)' }}
          >
            Le truc principal
          </div>
          <div className="font-serif text-[32px] leading-[1.05] mt-[6px] mb-[8px]">
            Mettre au pot.
          </div>
          <div
            className="text-[14px] leading-[1.45]"
            style={{ color: 'rgba(244,237,224,.75)', maxWidth: 280 }}
          >
            Un compte dédié, un IBAN, ce que tu veux. Pas de pression sur le montant.
          </div>
          <div className="flex items-center justify-between mt-[18px]">
            <div>
              <div
                className="font-mono text-[10px] tracking-[0.16em] uppercase"
                style={{ color: 'rgba(244,237,224,.55)' }}
              >
                déjà rassemblé
              </div>
              <div className="font-serif text-[28px] mt-[2px]">{formatEUR(total)}</div>
            </div>
            <div
              className="rounded-full bg-stamp text-paper flex items-center justify-center"
              style={{ width: 40, height: 40 }}
              aria-hidden
            >
              <IconArrow size={18} />
            </div>
          </div>
        </Link>
      </div>

      {/* Cards secondaires */}
      <div className="px-[22px] pt-[14px] pb-[8px] flex flex-col gap-[12px]">
        <SecondaryCard
          href="/photos"
          tagColor="bg-olive"
          abbr="ph."
          title="Tes vieilles photos d'eux."
          body="Voyages, soirées, mariages d'amis. Promis on garde tout pour nous."
        />
        <SecondaryCard
          href="/quizz"
          tagColor="bg-gold"
          abbr="quizz"
          title="Une question pour le quizz."
          body="Une histoire d'eux, transformée en question piège pour le jour J."
        />
        {whatsappUrl && (
          <SecondaryCard
            external
            href={whatsappUrl}
            tagColor="bg-stamp"
            abbr="sos."
            title="Une question, une idée ?"
            body="Le groupe WhatsApp pour tes pépins techniques ou tes suggestions. On répond vite."
          />
        )}
      </div>
      </div>
      </div>

      <div className="flex-1" />
      <BAFooter />
    </div>
    </PageContainer>
  )
}

function SecondaryCard({
  href,
  tagColor,
  abbr,
  title,
  body,
  external = false,
}: {
  href: string
  tagColor: string
  abbr: string
  title: string
  body: string
  external?: boolean
}) {
  const className =
    'ba-btn flex items-center gap-[14px] bg-paper-soft border border-paper-edge rounded-[18px] p-[18px] text-ink'
  const inner = (
    <>
      <div
        className={`${tagColor} relative shrink-0 flex items-center justify-center rounded-[4px]`}
        style={{ width: 48, height: 56, boxShadow: '0 6px 14px -8px rgba(76,50,30,.4)' }}
        aria-hidden
      >
        <span className="font-serif italic text-paper text-[17px]">{abbr}</span>
      </div>
      <div className="flex-1">
        <div className="font-serif text-[22px] leading-[1.1]">{title}</div>
        <div className="text-[13px] text-ink-soft mt-[4px] leading-[1.4]">{body}</div>
      </div>
      <IconArrow size={16} className="text-ink-mute" />
    </>
  )

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
        {inner}
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  )
}
