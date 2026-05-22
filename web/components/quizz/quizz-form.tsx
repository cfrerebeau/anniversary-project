'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BAStamp } from '@/components/design/buttons'
import { BACard } from '@/components/design/card'
import { submitQuizz } from '@/app/actions/quizz'
import {
  MIN_OPTIONS,
  MAX_OPTIONS,
  QuizQuestionFields,
} from '@/components/quizz/quiz-question-fields'

export function QuizzForm() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [correctIndex, setCorrectIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function setOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)))
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return
    setOptions((prev) => [...prev, ''])
  }

  function removeOption(i: number) {
    if (options.length <= MIN_OPTIONS) return
    setOptions((prev) => prev.filter((_, idx) => idx !== i))
    if (correctIndex === i) setCorrectIndex(0)
    else if (correctIndex > i) setCorrectIndex(correctIndex - 1)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set('question', question)
    for (const opt of options) fd.append('option', opt)
    fd.set('correct_index', String(correctIndex))
    startTransition(async () => {
      const res = await submitQuizz(fd)
      if (res.ok) {
        setDone(true)
        // Refresh pour que la liste « Tes questions » se peuple côté RSC sans
        // attendre un rechargement.
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function reset() {
    setDone(false)
    setQuestion('')
    setOptions(['', ''])
    setCorrectIndex(0)
    setError(null)
  }

  function viewMyQuestions() {
    setDone(false)
    setQuestion('')
    setOptions(['', ''])
    setCorrectIndex(0)
    setError(null)
    // Scroll vers l'ancre posée par /quizz/page.tsx.
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        document.getElementById('tes-questions')?.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }

  if (done) {
    return (
      <div className="ba-fade px-[22px]">
        <BACard className="p-[26px] text-center">
          <div className="ba-pop inline-block">
            <span className="ba-rubber text-olive" style={{ fontSize: 12 }}>
              Question ajoutée au quizz !
            </span>
          </div>
          <div className="font-serif text-[28px] mt-[16px] leading-[1.1]">
            <em className="italic">« {question} »</em>
          </div>
          <div className="text-[14px] text-ink-soft mt-[10px] leading-[1.5]">
            Elle pourrait bien finir dans le quiz du jour J.
          </div>
          <div className="flex flex-wrap gap-[10px] justify-center mt-[18px]">
            <button
              type="button"
              onClick={reset}
              className="ba-btn bg-ink text-paper py-[12px] px-[18px] rounded-[12px] text-[14px] font-semibold"
            >
              en proposer une autre
            </button>
            <button
              type="button"
              onClick={viewMyQuestions}
              className="ba-btn bg-transparent text-ink py-[12px] px-[18px] rounded-[12px] text-[14px] border border-paper-edge"
            >
              voir mes questions
            </button>
            <Link
              href="/merci?from=quizz"
              className="ba-btn bg-transparent text-ink py-[12px] px-[18px] rounded-[12px] text-[14px] border border-paper-edge"
            >
              terminé
            </Link>
          </div>
        </BACard>
      </div>
    )
  }

  return (
    <div className="px-[22px]">
      <BACard className="p-[18px]">
        <form onSubmit={onSubmit}>
          <QuizQuestionFields
            question={question}
            options={options}
            correctIndex={correctIndex}
            onChangeQuestion={setQuestion}
            onChangeOption={setOption}
            onAddOption={addOption}
            onRemoveOption={removeOption}
            onSetCorrect={setCorrectIndex}
            disabled={pending}
          />

          <div className="mt-[24px] pt-[18px] border-t border-paper-edge">
            {error && (
              <div role="alert" className="ba-fade text-[13px] text-stamp mb-[12px]">
                {error}
              </div>
            )}
            <BAStamp full color="olive" type="submit" disabled={pending}>
              {pending ? 'Une seconde…' : 'Valider ma question.'}
            </BAStamp>
          </div>
        </form>
      </BACard>

      <div
        className="mt-[22px] rounded-[12px] flex gap-[10px] py-[14px] px-[16px]"
        style={{ background: 'rgba(184,146,76,.08)' }}
      >
        <div className="text-[18px]" aria-hidden>💡</div>
        <div className="text-[13px] text-ink-soft leading-[1.5]">
          T&apos;en as plusieurs ? Reviens autant de fois que tu veux.
        </div>
      </div>
    </div>
  )
}
