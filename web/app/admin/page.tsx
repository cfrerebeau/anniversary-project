import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { isoSecondsAgo } from '@/lib/format'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { BACard } from '@/components/design/card'
import { IconArrow } from '@/components/design/icons'

export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  await requireAdmin()
  const service = getServiceClient()

  const dayAgoISO = isoSecondsAgo(24 * 3600)

  const [
    guestsTotal,
    guestsBlocked,
    guestsLoggedIn,
    guestsLast24h,
    photosCount,
    anecdotesCount,
    cagnotteMessagesCount,
  ] = await Promise.all([
    service.from('guests').select('*', { count: 'exact', head: true }),
    service.from('guests').select('*', { count: 'exact', head: true }).eq('is_blocked', true),
    service
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .not('first_visit_at', 'is', null),
    service
      .from('guests')
      .select('*', { count: 'exact', head: true })
      .gte('last_visit_at', dayAgoISO),
    service.from('photos').select('*', { count: 'exact', head: true }),
    service.from('anecdotes').select('*', { count: 'exact', head: true }),
    service.from('cagnotte_messages').select('*', { count: 'exact', head: true }),
  ])

  return (
    <PageContainer width="wide">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/" />
        <BAPageTitle
          eyebrow="admin · cabane"
          title="Coulisses."
          italicWord="Coulisses"
          sub="Vue d'ensemble — qui s'est connecté, ce que les gens ont partagé, et un endroit pour ajouter un invité oublié."
        />

        <div className="px-[22px] grid grid-cols-2 gap-[12px] lg:grid-cols-4">
          <Stat label="Invités" value={guestsTotal.count ?? 0} />
          <Stat label="Bloqués" value={guestsBlocked.count ?? 0} />
          <Stat label="Connectés ≥ 1 fois" value={guestsLoggedIn.count ?? 0} />
          <Stat label="Vus < 24h" value={guestsLast24h.count ?? 0} />
        </div>

        <div className="px-[22px] mt-[14px] grid grid-cols-1 gap-[12px] lg:grid-cols-3">
          <NavCard
            href="/admin/guests"
            abbr="inv."
            tagColor="bg-olive"
            title="Invités"
            body="Qui est dans la liste, qui s'est connecté, et ajouter un nouvel invité."
            meta={`${guestsTotal.count ?? 0} au total`}
          />
          <NavCard
            href="/admin/photos"
            abbr="ph."
            tagColor="bg-gold"
            title="Photos"
            body="Toutes les photos partagées, avec uploader et légende."
            meta={`${photosCount.count ?? 0} partagées`}
          />
          <NavCard
            href="/admin/anecdotes"
            abbr="anec."
            tagColor="bg-stamp"
            title="Anecdotes"
            body="Toutes les histoires écrites par les complices."
            meta={`${anecdotesCount.count ?? 0} racontées`}
          />
        </div>

        <div className="px-[22px] mt-[18px] text-[12px] text-ink-mute font-mono uppercase tracking-[0.12em]">
          {cagnotteMessagesCount.count ?? 0} messages cagnotte
        </div>

        <div className="h-[40px]" />
      </div>
    </PageContainer>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <BACard className="p-[16px]">
      <div className="font-mono text-[10px] text-ink-mute tracking-[0.18em] uppercase">
        {label}
      </div>
      <div className="font-serif text-[28px] leading-[1] mt-[4px]">{value}</div>
    </BACard>
  )
}

function NavCard({
  href,
  abbr,
  tagColor,
  title,
  body,
  meta,
}: {
  href: string
  abbr: string
  tagColor: string
  title: string
  body: string
  meta: string
}) {
  return (
    <Link
      href={href}
      className="ba-btn flex items-center gap-[14px] bg-paper-soft border border-paper-edge rounded-[18px] p-[18px] text-ink"
    >
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
        <div className="font-mono text-[11px] text-ink-mute tracking-[0.08em] uppercase mt-[6px]">
          {meta}
        </div>
      </div>
      <IconArrow size={16} className="text-ink-mute" />
    </Link>
  )
}
