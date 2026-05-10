import { requireGuest } from '@/lib/auth'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { QuizzForm } from '@/components/quizz/quizz-form'

export const dynamic = 'force-dynamic'

export default async function QuizzPage() {
  await requireGuest()
  return (
    <PageContainer width="normal">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/" />
        <BAPageTitle
          eyebrow="03 · quizz"
          title="Une question pour le quizz."
          italicWord="question"
          sub="Tu connais une histoire de Brice ou d'Alix ? Transforme-la en question piège pour le quiz du jour J. Plusieurs réponses possibles, une seule vraie."
        />
        <QuizzForm />
        <div className="h-[30px]" />
      </div>
    </PageContainer>
  )
}
