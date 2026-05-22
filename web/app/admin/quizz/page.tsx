import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { QuizzCard } from '@/components/quizz/quizz-card'

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

  const { data: rowsRaw, error: queryErr } = await service
    .from('quizz')
    .select(
      'id, uploader_name, question_text, options, correct_index, created_at, guests(email, full_name)',
    )
    .order('created_at', { ascending: false })

  if (queryErr) {
    console.error('[admin/quizz:query]', queryErr)
  }
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
            <QuizzCard
              key={q.id}
              id={q.id}
              question={q.question_text}
              options={q.options}
              correctIndex={q.correct_index}
              uploaderName={q.uploader_name ?? q.guests?.full_name ?? null}
              uploaderEmail={q.guests?.email ?? null}
              createdAtLabel={dateFmt.format(new Date(q.created_at))}
              variant="admin"
            />
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
