import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { formatEUR } from '@/lib/format'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { BACard } from '@/components/design/card'

export const dynamic = 'force-dynamic'

type MessageRow = {
  id: string
  display_name: string | null
  amount_cents: number | null
  message: string | null
  created_at: string
  guests: { email: string; full_name: string | null } | null
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export default async function AdminMessagesPage() {
  await requireAdmin()
  const service = getServiceClient()

  const { data: rowsRaw, error } = await service
    .from('cagnotte_messages')
    .select(
      'id, display_name, amount_cents, message, created_at, guests(email, full_name)',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/messages:query]', error)
  }
  const rows = (rowsRaw ?? []) as unknown as MessageRow[]

  return (
    <PageContainer width="wide">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/admin" label="admin" />
        <BAPageTitle
          eyebrow="admin · messages"
          title="Tous les mots reçus."
          italicWord="mots"
          sub={`${rows.length} message${rows.length > 1 ? 's' : ''} dans la cagnotte.`}
        />

        <div className="px-[22px] mb-[14px] flex justify-end">
          <a
            href="/api/admin/messages/export.csv"
            download
            className="ba-btn bg-ink text-paper rounded-[14px] px-[18px] py-[12px] text-[14px] font-semibold inline-flex items-center gap-[8px]"
            style={{
              boxShadow:
                '0 1px 0 rgba(255,255,255,.12) inset, 0 6px 16px -8px rgba(21,35,59,.6)',
            }}
          >
            Exporter CSV
          </a>
        </div>

        <div className="px-[22px] flex flex-col gap-[14px]">
          {rows.map((r) => (
            <BACard key={r.id} className="p-[20px]">
              <div className="flex items-baseline justify-between gap-[12px]">
                <div className="font-serif text-[20px] leading-[1.15]">
                  {r.display_name ?? '—'}
                </div>
                <div className="font-mono text-[13px] text-ink-soft">
                  {r.amount_cents != null ? formatEUR(r.amount_cents) : 'Montant non indiqué'}
                </div>
              </div>

              {r.message && (
                <div className="mt-[10px] text-[14px] leading-[1.5] whitespace-pre-wrap">
                  {r.message}
                </div>
              )}

              <div className="mt-[12px] pt-[10px] border-t border-paper-edge text-[12px] text-ink-soft flex flex-wrap gap-x-[10px] gap-y-[2px]">
                <span>{r.guests?.full_name ?? '—'}</span>
                <span className="text-ink-mute">· {r.guests?.email ?? '—'}</span>
                <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-mute ml-auto">
                  {dateFmt.format(new Date(r.created_at))}
                </span>
              </div>
            </BACard>
          ))}
          {rows.length === 0 && (
            <div className="text-center text-ink-mute py-[40px]">
              Aucun message cagnotte pour l&apos;instant.
            </div>
          )}
        </div>

        <div className="h-[40px]" />
      </div>
    </PageContainer>
  )
}
