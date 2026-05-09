import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { BACard } from '@/components/design/card'

export const dynamic = 'force-dynamic'

type AnecdoteRow = {
  id: string
  uploader_name: string | null
  title: string | null
  story: string
  since_relationship: string | null
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

export default async function AdminAnecdotesPage() {
  await requireAdmin()
  const service = getServiceClient()

  const { data: rowsRaw } = await service
    .from('anecdotes')
    .select(
      'id, uploader_name, title, story, since_relationship, created_at, guests(email, full_name)',
    )
    .order('created_at', { ascending: false })

  const rows = (rowsRaw ?? []) as unknown as AnecdoteRow[]

  return (
    <PageContainer width="wide">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/admin" label="admin" />
        <BAPageTitle
          eyebrow="admin · anecdotes"
          title="Toutes les histoires."
          italicWord="histoires"
          sub={`${rows.length} anecdote${rows.length > 1 ? 's' : ''} récoltée${rows.length > 1 ? 's' : ''} par les complices.`}
        />

        <div className="px-[22px] flex flex-col gap-[14px]">
          {rows.map((a) => (
            <BACard key={a.id} className="p-[20px]">
              <div className="flex items-baseline gap-[10px] flex-wrap">
                {a.title && (
                  <div className="font-serif text-[22px] leading-[1.15]">{a.title}</div>
                )}
                {a.since_relationship && (
                  <span className="font-mono text-[10px] text-ink-mute uppercase tracking-[0.12em] bg-paper-edge rounded-[4px] px-[6px] py-[2px]">
                    {a.since_relationship}
                  </span>
                )}
              </div>

              <div className="mt-[10px] text-[15px] leading-[1.55] whitespace-pre-line">
                {a.story}
              </div>

              <div className="mt-[12px] pt-[10px] border-t border-paper-edge text-[12px] text-ink-soft flex flex-wrap gap-x-[10px] gap-y-[2px]">
                <span>{a.uploader_name ?? a.guests?.full_name ?? '—'}</span>
                {a.guests?.email && <span className="text-ink-mute">· {a.guests.email}</span>}
                <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-mute ml-auto">
                  {dateFmt.format(new Date(a.created_at))}
                </span>
              </div>
            </BACard>
          ))}
          {rows.length === 0 && (
            <div className="text-center text-ink-mute py-[40px]">
              Aucune anecdote partagée pour l&apos;instant.
            </div>
          )}
        </div>

        <div className="h-[40px]" />
      </div>
    </PageContainer>
  )
}
