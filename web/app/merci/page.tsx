import Image from 'next/image'
import Link from 'next/link'
import { requireGuest } from '@/lib/auth'
import { BAHeader } from '@/components/design/header'
import { BACard } from '@/components/design/card'
import { BAEyebrow } from '@/components/design/eyebrow'
import { BAStampIcon } from '@/components/design/stamp-icon'
import { PageContainer } from '@/components/design/page-container'
import { IconArrow } from '@/components/design/icons'
import { formatDateFR } from '@/lib/format'

type Variant = {
  eyebrow: string
  stampLabel: string
  stampColor: 'stamp' | 'olive' | 'gold'
  h1: string
  italic: string
  body: string
  sign: string
}

const VARIANTS: Record<'cagnotte' | 'photos' | 'quizz', Variant> = {
  cagnotte: {
    eyebrow: 'mot de remerciement',
    stampLabel: 'Merci.',
    stampColor: 'stamp',
    h1: 'On a coché ton nom sur la liste.',
    italic: 'liste',
    body: "Brice et Alix ne savent toujours rien. Le compteur grimpe en silence. T'as fait ta part — et largement.",
    sign: 'M., L., T. & les autres',
  },
  photos: {
    eyebrow: 'le carnet est plus épais',
    stampLabel: 'Reçu.',
    stampColor: 'olive',
    h1: 'Trois photos de plus dans la boîte.',
    italic: 'boîte',
    body: "On a hâte de tout regarder ensemble. Continue à fouiller dans tes vieux dossiers — y'a souvent des pépites en bas du téléphone.",
    sign: 'M., L., T. & les autres',
  },
  quizz: {
    eyebrow: 'quizz enrichi',
    stampLabel: 'Top.',
    stampColor: 'gold',
    h1: 'Ta question est dans la pile.',
    italic: 'pile',
    body: "On lit tout ce week-end. Si elle finit dans le quiz, t'auras forcément la bonne réponse — c'est un détail qui compte.",
    sign: 'M., L., T. & les autres',
  },
}

const STAMP_COLOR_HEX = {
  stamp: 'var(--color-stamp)',
  olive: 'var(--color-olive)',
  gold: 'var(--color-gold)',
}

export const dynamic = 'force-dynamic'

export default async function MerciPage(props: PageProps<'/merci'>) {
  await requireGuest()
  const sp = await props.searchParams
  const fromRaw = (Array.isArray(sp.from) ? sp.from[0] : sp.from) ?? 'cagnotte'
  const kind = (['cagnotte', 'photos', 'quizz'] as const).includes(fromRaw as 'cagnotte')
    ? (fromRaw as 'cagnotte' | 'photos' | 'quizz')
    : 'cagnotte'
  const v = VARIANTS[kind]

  const dateFr = formatDateFR(new Date(), { day: 'numeric', month: 'long' })

  // Splits "h1" sur l'italic word pour en mettre une partie en italique
  const [before, after] = v.h1.includes(v.italic)
    ? v.h1.split(v.italic)
    : [v.h1, '']

  return (
    <PageContainer width="normal">
    <div className="min-h-screen pt-[54px]">
      <BAHeader backHref="/" />

      <div className="px-[22px] pt-[20px]">
        <div className="ba-pop inline-block" style={{ transform: 'rotate(-4deg)' }}>
          <span
            className="ba-rubber"
            style={{ color: STAMP_COLOR_HEX[v.stampColor], fontSize: 14, padding: '4px 14px' }}
          >
            {v.stampLabel}
          </span>
        </div>
        <BAEyebrow>{v.eyebrow}</BAEyebrow>
      </div>

      <div className="px-[22px] pt-[12px]">
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.01em] m-0">
          {before}
          <em className="italic">{v.italic}</em>
          {after}
        </h1>
        <p
          className="mt-[14px] text-[17px] text-ink-soft leading-[1.55]"
          style={{ textWrap: 'pretty' }}
        >
          {v.body}
        </p>
      </div>

      {/* Card "lettre" — photo couple en background subtil */}
      <div className="px-[22px] pt-[22px]">
        <BACard className="p-[24px] relative overflow-hidden">
          <Image
            src="/couple-merci.jpg"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            style={{ objectFit: 'cover', opacity: 0.12, pointerEvents: 'none' }}
            aria-hidden
          />
          <div className="relative">
            <div
              className="absolute"
              style={{ top: 0, right: 0, transform: 'rotate(7deg)' }}
              aria-hidden
            >
              <BAStampIcon size={48} label="🤫" />
            </div>
            <div className="font-mono text-[10px] text-ink-mute tracking-[0.18em] uppercase">
              Le {dateFr}
            </div>
            <div
              className="font-serif italic text-[24px] leading-[1.35] mt-[14px] text-ink"
              style={{ paddingRight: 60 }}
            >
              « Sans toi ce serait moins drôle. C&apos;est sincère, on a vérifié. »
            </div>
            <div className="font-serif italic text-[17px] text-ink-soft mt-[18px]">
              — {v.sign} <span className="text-stamp">🤫</span>
            </div>
          </div>
        </BACard>
      </div>

      {/* Cross-link nudges */}
      <div className="px-[22px] pt-[24px]">
        <BAEyebrow color="olive">Tant que tu es là</BAEyebrow>
        <div className="mt-[10px] flex flex-col gap-[8px]">
          {kind !== 'cagnotte' && (
            <NudgeLink href="/cagnotte" primary>
              aller à la cagnotte
            </NudgeLink>
          )}
          {kind !== 'photos' && (
            <NudgeLink href="/photos">déposer des photos</NudgeLink>
          )}
          {kind !== 'quizz' && (
            <NudgeLink href="/quizz">proposer une question</NudgeLink>
          )}
        </div>
      </div>

      <div className="h-[40px]" />
    </div>
    </PageContainer>
  )
}

function NudgeLink({
  href,
  children,
  primary = false,
}: {
  href: string
  children: React.ReactNode
  primary?: boolean
}) {
  return (
    <Link
      href={href}
      className={`ba-btn flex justify-between items-center py-[14px] px-[18px] rounded-[14px] text-[15px] font-medium ${
        primary
          ? 'bg-ink text-paper'
          : 'bg-paper-soft text-ink border border-paper-edge'
      }`}
    >
      <span>{children}</span>
      <IconArrow size={16} className={primary ? '' : 'text-ink-mute'} />
    </Link>
  )
}
