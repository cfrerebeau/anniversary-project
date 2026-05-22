import { requireGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { BAEyebrow } from '@/components/design/eyebrow'
import { QuizzForm } from '@/components/quizz/quizz-form'
import { QuizzCard } from '@/components/quizz/quizz-card'

export const dynamic = 'force-dynamic'

type QuizzRow = {
  id: string
  question_text: string
  options: string[]
  correct_index: number
  created_at: string
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export default async function QuizzPage() {
  const guest = await requireGuest()
  const service = getServiceClient()

  const { data: rowsRaw, error: queryErr } = await service
    .from('quizz')
    .select('id, question_text, options, correct_index, created_at')
    .eq('guest_id', guest.id)
    .order('created_at', { ascending: false })

  if (queryErr) {
    console.error('[quizz/page:query]', queryErr, { guestId: guest.id })
  }
  const rows = (rowsRaw ?? []) as QuizzRow[]

  return (
    <PageContainer width="normal">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/" />
        <BAPageTitle
          eyebrow="03 · quizz"
          title="Une question pour le quizz."
          italicWord="question"
          sub="Connais tu bien Brice ou d'Alix ? Trouve des questions pour le quizz du jour J. Plusieurs réponses possibles, une seule vraie."
        />
        <QuizzForm />

        {rows.length > 0 && (
          <div id="tes-questions" className="px-[22px] pt-[30px]">
            <div className="flex items-center justify-between mb-[12px]">
              <BAEyebrow>Tes questions</BAEyebrow>
              <div className="text-[12px] text-ink-mute">
                {rows.length} question{rows.length > 1 ? 's' : ''}
              </div>
            </div>
            <div className="flex flex-col gap-[14px]">
              {rows.map((q) => (
                <QuizzCard
                  key={q.id}
                  id={q.id}
                  question={q.question_text}
                  options={q.options}
                  correctIndex={q.correct_index}
                  createdAtLabel={dateFmt.format(new Date(q.created_at))}
                  variant="mine"
                />
              ))}
            </div>
          </div>
        )}

        <div className="h-[30px]" />
      </div>
    </PageContainer>
  )
}
