'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { BAStamp } from '@/components/design/buttons'
import { BACard } from '@/components/design/card'
import { BALabel } from '@/components/design/eyebrow'
import { submitQuizz } from '@/app/actions/quizz'

const MIN_OPTIONS = 2
const MAX_OPTIONS = 4

export function QuizzForm() {
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
      if (res.ok) setDone(true)
      else setError(res.error)
    })
  }

  function reset() {
    setDone(false)
    setQuestion('')
    setOptions(['', ''])
    setCorrectIndex(0)
    setError(null)
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
          <div className="flex gap-[10px] justify-center mt-[18px]">
            <button
              type="button"
              onClick={reset}
              className="ba-btn bg-ink text-paper py-[12px] px-[18px] rounded-[12px] text-[14px] font-semibold"
            >
              en proposer une autre
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
          <div className="mb-[14px]">
            <BALabel>La question</BALabel>
            <textarea
              className="ba-input"
              rows={3}
              placeholder="ex. Que ne trouve t'on PAS dans la cuisine de Brice et Alix ?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              style={{ resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
              maxLength={280}
              required
              minLength={8}
            />
            <div className="text-[11px] text-ink-mute mt-[6px] ml-[2px] flex justify-between">
              <span>Une vraie histoire, transformée en devinette.</span>
              <span>{question.length}/280</span>
            </div>
          </div>

          <div className="mb-[14px]">
            <BALabel>Les réponses possibles · coche la bonne</BALabel>
            <div className="flex flex-col gap-[8px]">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-[8px]">
                  <button
                    type="button"
                    onClick={() => setCorrectIndex(i)}
                    aria-label={`Marquer l'option ${i + 1} comme bonne réponse`}
                    className="ba-btn shrink-0 flex items-center justify-center rounded-full"
                    style={{
                      width: 28,
                      height: 28,
                      background:
                        correctIndex === i ? 'var(--color-olive)' : 'transparent',
                      border: `1px solid ${
                        correctIndex === i ? 'var(--color-olive)' : 'var(--color-paper-edge)'
                      }`,
                      color: correctIndex === i ? 'var(--color-paper)' : 'var(--color-ink-mute)',
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {correctIndex === i ? '✓' : ''}
                  </button>
                  <input
                    className="ba-input"
                    placeholder={`Réponse ${i + 1}`}
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    maxLength={120}
                    required
                  />
                  {options.length > MIN_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      aria-label={`Retirer l'option ${i + 1}`}
                      className="ba-btn shrink-0 text-ink-mute"
                      style={{
                        width: 28,
                        height: 28,
                        fontSize: 18,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < MAX_OPTIONS && (
              <button
                type="button"
                onClick={addOption}
                className="ba-btn mt-[10px] text-[13px] text-ink-soft underline-offset-2 hover:underline"
              >
                + ajouter une réponse ({options.length}/{MAX_OPTIONS})
              </button>
            )}
          </div>

          {error && (
            <div className="ba-fade text-[13px] text-stamp mb-[12px]">{error}</div>
          )}
          <BAStamp full color="olive" type="submit" disabled={pending}>
            {pending ? 'Une seconde…' : 'Ajouter au Quizz.'}
          </BAStamp>
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
