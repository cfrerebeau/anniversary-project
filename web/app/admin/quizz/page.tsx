import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { BACard } from '@/components/design/card'

export const dynamic = 'force-dynamic'

type QuizzRow = {
  id: string
  uploader_name: string | null
  question_text: string
  options: string[]
  correct_index: number
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

export default async function AdminQuizzPage() {
  await requireAdmin()
  const service = getServiceClient()

  const { data: rowsRaw } = await service
    .from('quizz')
    .select(
      'id, uploader_name, question_text, options, correct_index, created_at, guests(email, full_name)',
    )
    .order('created_at', { ascending: false })

  const rows = (rowsRaw ?? []) as unknown as QuizzRow[]

  return (
    <PageContainer width="wide">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/admin" label="admin" />
        <BAPageTitle
          eyebrow="admin · quizz"
          title="Toutes les questions."
          italicWord="questions"
          sub={`${rows.length} question${rows.length > 1 ? 's' : ''} proposée${rows.length > 1 ? 's' : ''} par les complices.`}
        />

        <div className="px-[22px] flex flex-col gap-[14px]">
          {rows.map((q) => (
            <BACard key={q.id} className="p-[20px]">
              <div className="font-serif text-[22px] leading-[1.15]">
                <em className="italic">« {q.question_text} »</em>
              </div>

              <ul className="mt-[12px] flex flex-col gap-[6px]">
                {q.options.map((opt, i) => (
                  <li
                    key={i}
                    className={`text-[14px] leading-[1.5] flex items-center gap-[8px] ${
                      i === q.correct_index ? 'text-olive font-semibold' : 'text-ink-soft'
                    }`}
                  >
                    <span
                      className="font-mono text-[10px] tracking-[0.12em] uppercase"
                      aria-hidden
                    >
                      {i === q.correct_index ? '✓' : '·'}
                    </span>
                    <span>{opt}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-[12px] pt-[10px] border-t border-paper-edge text-[12px] text-ink-soft flex flex-wrap gap-x-[10px] gap-y-[2px]">
                <span>{q.uploader_name ?? q.guests?.full_name ?? '—'}</span>
                {q.guests?.email && <span className="text-ink-mute">· {q.guests.email}</span>}
                <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-mute ml-auto">
                  {dateFmt.format(new Date(q.created_at))}
                </span>
              </div>
            </BACard>
          ))}
          {rows.length === 0 && (
            <div className="text-center text-ink-mute py-[40px]">
              Aucune question proposée pour l&apos;instant.
            </div>
          )}
        </div>

        <div className="h-[40px]" />
      </div>
    </PageContainer>
  )
}
