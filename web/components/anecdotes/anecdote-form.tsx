'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { BAStamp } from '@/components/design/buttons'
import { BACard } from '@/components/design/card'
import { BALabel } from '@/components/design/eyebrow'
import { submitAnecdote } from '@/app/actions/anecdote'

const SINCE_OPTIONS = ['<1 an', '1-5 ans', '5-15 ans', 'la vie'] as const

export function AnecdoteForm() {
  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [since, setSince] = useState<string>('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set('title', title)
    fd.set('story', story)
    if (since) fd.set('since', since)
    startTransition(async () => {
      const res = await submitAnecdote(fd)
      if (res.ok) setDone(true)
      else setError(res.error)
    })
  }

  function reset() {
    setDone(false)
    setTitle('')
    setStory('')
    setSince('')
    setError(null)
  }

  if (done) {
    return (
      <div className="ba-fade px-[22px]">
        <BACard className="p-[26px] text-center">
          <div className="ba-pop inline-block">
            <span className="ba-rubber text-olive" style={{ fontSize: 12 }}>
              Reçu cinq sur cinq
            </span>
          </div>
          <div className="font-serif text-[28px] mt-[16px] leading-[1.1]">
            <em className="italic">« {title || 'Sans titre'} »</em>
          </div>
          <div className="text-[14px] text-ink-soft mt-[10px] leading-[1.5]">
            C&apos;est dans la boîte. On lira tout, promis.
          </div>
          <div className="flex gap-[10px] justify-center mt-[18px]">
            <button
              type="button"
              onClick={reset}
              className="ba-btn bg-ink text-paper py-[12px] px-[18px] rounded-[12px] text-[14px] font-semibold"
            >
              en raconter une autre
            </button>
            <Link
              href="/merci?from=anecdotes"
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
            <BALabel>Un titre, en deux mots</BALabel>
            <input
              className="ba-input"
              placeholder="ex. La fois du karaoké"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="mb-[14px]">
            <BALabel>L&apos;anecdote</BALabel>
            <textarea
              className="ba-input"
              rows={6}
              placeholder="Allez, raconte. Pas besoin de bien écrire."
              value={story}
              onChange={(e) => setStory(e.target.value)}
              style={{ resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
              maxLength={4000}
              required
              minLength={20}
            />
            <div className="text-[11px] text-ink-mute mt-[6px] ml-[2px] flex justify-between">
              <span>Vraie ou un peu remaniée — on prend.</span>
              <span>{story.length} caractères</span>
            </div>
          </div>
          <div className="mb-[18px]">
            <BALabel>Depuis combien de temps tu connais B&amp;A ?</BALabel>
            <div className="grid grid-cols-4 gap-[8px]">
              {SINCE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSince(opt)}
                  className="ba-btn rounded-[10px] px-[8px] py-[10px] text-[13px]"
                  style={{
                    background: since === opt ? 'var(--color-ink)' : 'transparent',
                    color: since === opt ? 'var(--color-paper)' : 'var(--color-ink)',
                    border: `1px solid ${since === opt ? 'var(--color-ink)' : 'var(--color-paper-edge)'}`,
                    fontWeight: since === opt ? 600 : 500,
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className="ba-fade text-[13px] text-stamp mb-[12px]">{error}</div>
          )}
          <BAStamp full color="olive" type="submit" disabled={pending}>
            {pending ? 'Une seconde…' : 'Glisser dans la boîte.'}
          </BAStamp>
        </form>
      </BACard>

      <div
        className="mt-[22px] rounded-[12px] flex gap-[10px] py-[14px] px-[16px]"
        style={{ background: 'rgba(184,146,76,.08)' }}
      >
        <div className="text-[18px]" aria-hidden>💡</div>
        <div className="text-[13px] text-ink-soft leading-[1.5]">
          T&apos;en as plusieurs ? Reviens autant de fois que tu veux. Mieux vaut une anecdote
          courte qu&apos;une anecdote qui n&apos;arrive jamais.
        </div>
      </div>
    </div>
  )
}
