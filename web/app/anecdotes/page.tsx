import { requireGuest } from '@/lib/auth'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { AnecdoteForm } from '@/components/anecdotes/anecdote-form'

export const dynamic = 'force-dynamic'

export default async function AnecdotesPage() {
  await requireGuest()
  return (
    <PageContainer width="normal">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/" />
        <BAPageTitle
          eyebrow="03 · anecdotes"
          title="Une anecdote à raconter."
          italicWord="anecdote"
          sub="Un truc qu'ils ont fait, dit, ou survécu ensemble. On verra plus tard ce qu'on en fait — peut-être un quiz, peut-être pas."
        />
        <AnecdoteForm />
        <div className="h-[30px]" />
      </div>
    </PageContainer>
  )
}
