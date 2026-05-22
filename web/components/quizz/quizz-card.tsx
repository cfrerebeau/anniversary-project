'use client'

import { startTransition, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BACard } from '@/components/design/card'
import { updateQuizz, deleteQuizz } from '@/app/actions/quizz'
import {
  MIN_OPTIONS,
  MAX_OPTIONS,
  QuizQuestionFields,
} from '@/components/quizz/quiz-question-fields'

type Props = {
  id: string
  question: string
  options: string[]
  correctIndex: number
  uploaderName?: string | null
  uploaderEmail?: string | null
  createdAtLabel?: string
  variant: 'admin' | 'mine'
}

export function QuizzCard({
  id,
  question,
  options,
  correctIndex,
  uploaderName,
  uploaderEmail,
  createdAtLabel,
  variant,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draftQuestion, setDraftQuestion] = useState(question)
  const [draftOptions, setDraftOptions] = useState<string[]>(options)
  const [draftCorrect, setDraftCorrect] = useState(correctIndex)
  const [error, setError] = useState<string | null>(null)
  const [pendingSave, startSave] = useTransition()
  const [pendingDelete, startDelete] = useTransition()
  const deletingRef = useRef(false)

  const busy = pendingSave || pendingDelete

  function startEditing() {
    setDraftQuestion(question)
    setDraftOptions(options)
    setDraftCorrect(correctIndex)
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    setError(null)
  }

  function addOption() {
    if (draftOptions.length >= MAX_OPTIONS) return
    setDraftOptions((prev) => [...prev, ''])
  }

  function removeOption(i: number) {
    if (draftOptions.length <= MIN_OPTIONS) return
    setDraftOptions((prev) => prev.filter((_, idx) => idx !== i))
    if (draftCorrect === i) setDraftCorrect(0)
    else if (draftCorrect > i) setDraftCorrect(draftCorrect - 1)
  }

  function setOption(i: number, value: string) {
    setDraftOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)))
  }

  function save(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault()
    if (deletingRef.current) return
    setError(null)
    const fd = new FormData()
    fd.set('id', id)
    fd.set('question', draftQuestion)
    for (const opt of draftOptions) fd.append('option', opt)
    fd.set('correct_index', String(draftCorrect))
    startSave(async () => {
      const res = await updateQuizz(fd)
      if (res.ok) {
        // Wrap dans une transition pour que le swap édition→lecture attende
        // que le nouveau payload RSC soit prêt — évite le flash où on
        // afficherait brièvement les anciennes props après save.
        startTransition(() => {
          setEditing(false)
          router.refresh()
        })
      } else {
        setError(res.error)
        if (res.error === 'Question introuvable.') {
          startTransition(() => {
            setEditing(false)
            router.refresh()
          })
        }
      }
    })
  }

  function onDeleteClick() {
    if (!window.confirm('Supprimer cette question ? Action irréversible.')) return
    deletingRef.current = true
    setError(null)
    const fd = new FormData()
    fd.set('id', id)
    startDelete(async () => {
      const res = await deleteQuizz(fd)
      if (res.ok) {
        router.refresh()
      } else {
        deletingRef.current = false
        setError(res.error)
        if (res.error === 'Question introuvable.') router.refresh()
      }
    })
  }

  return (
    <BACard
      className="p-[20px]"
      style={{ opacity: pendingDelete ? 0.5 : 1, transition: 'opacity .15s' }}
    >
      {editing ? (
        <form onSubmit={save} aria-live="polite">
          <QuizQuestionFields
            question={draftQuestion}
            options={draftOptions}
            correctIndex={draftCorrect}
            onChangeQuestion={setDraftQuestion}
            onChangeOption={setOption}
            onAddOption={addOption}
            onRemoveOption={removeOption}
            onSetCorrect={setDraftCorrect}
            disabled={busy}
          />
          {error && (
            <div role="alert" className="text-[13px] text-stamp mb-[10px]">
              {error}
            </div>
          )}
          <div className="flex gap-[8px] justify-end">
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="ba-btn bg-transparent text-ink-soft text-[13px] disabled:opacity-50"
              style={{ padding: '8px 12px' }}
            >
              annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              className="ba-btn bg-ink text-paper rounded-[10px] text-[13px] font-semibold disabled:opacity-50"
              style={{ padding: '8px 14px' }}
            >
              {pendingSave ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      ) : (
        <div aria-live="polite">
          <div className="font-serif text-[22px] leading-[1.15]">
            <em className="italic">« {question} »</em>
          </div>

          <ul className="mt-[12px] flex flex-col gap-[6px]">
            {options.map((opt, i) => (
              <li
                key={i}
                className={`text-[14px] leading-[1.5] flex items-center gap-[8px] ${
                  i === correctIndex ? 'text-olive font-semibold' : 'text-ink-soft'
                }`}
              >
                <span
                  className="font-mono text-[10px] tracking-[0.12em] uppercase"
                  aria-hidden
                >
                  {i === correctIndex ? '✓' : '·'}
                </span>
                <span>{opt}</span>
              </li>
            ))}
          </ul>

          {error && (
            <div role="alert" className="text-[12px] text-stamp mt-[10px]">
              {error}
            </div>
          )}

          <div className="mt-[12px] pt-[10px] border-t border-paper-edge text-[12px] text-ink-soft flex flex-wrap items-center gap-x-[10px] gap-y-[4px]">
            {variant === 'admin' ? (
              <>
                <span>{uploaderName ?? '—'}</span>
                {uploaderEmail && <span className="text-ink-mute">· {uploaderEmail}</span>}
                {createdAtLabel && (
                  <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-mute">
                    {createdAtLabel}
                  </span>
                )}
              </>
            ) : (
              createdAtLabel && (
                <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-mute">
                  {createdAtLabel}
                </span>
              )
            )}
            <div className="ml-auto flex gap-[10px]">
              <button
                type="button"
                onClick={startEditing}
                disabled={busy}
                className="ba-btn bg-transparent text-ink-soft text-[12px] underline underline-offset-[3px] hover:text-ink disabled:opacity-50"
              >
                éditer
              </button>
              <button
                type="button"
                onClick={onDeleteClick}
                disabled={busy}
                className="ba-btn bg-transparent text-ink-mute text-[12px] underline underline-offset-[3px] hover:text-stamp-deep disabled:opacity-50"
              >
                {pendingDelete ? 'suppression…' : 'supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </BACard>
  )
}
