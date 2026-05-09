'use client'

import { useState, useTransition } from 'react'
import { BAPrimary } from '@/components/design/buttons'
import { BACard } from '@/components/design/card'
import { BALabel } from '@/components/design/eyebrow'
import { IconCheck } from '@/components/design/icons'
import { requestAccessLink } from '@/app/actions/access'

export function AccessForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!email.includes('@')) {
      setError("Cette adresse a l'air bancale.")
      return
    }
    const fd = new FormData()
    fd.set('email', email)
    startTransition(async () => {
      const result = await requestAccessLink(fd)
      if (result.status === 'invalid' || result.status === 'rate_limited') {
        setError(result.message)
        return
      }
      setSent(true)
    })
  }

  if (sent) {
    return (
      <div className="ba-fade mt-[28px]">
        <BACard className="p-[22px]">
          <div className="flex gap-[12px] items-start">
            <div
              className="rounded-full text-success flex items-center justify-center shrink-0"
              style={{ width: 36, height: 36, background: 'rgba(94,122,82,.12)' }}
            >
              <IconCheck size={18} />
            </div>
            <div>
              <div className="font-serif text-[22px] leading-[1.1] mb-[4px]">C&apos;est parti.</div>
              <div className="text-[14px] text-ink-soft leading-[1.5]">
                Si cette adresse est dans la liste, un lien vient de filer dans ta boîte. Pense à
                regarder en spam, ça arrive.
              </div>
            </div>
          </div>
        </BACard>
        <div className="mt-[14px] text-center text-[13px] text-ink-mute">
          <button
            type="button"
            className="ba-btn bg-transparent text-ink p-[6px] text-[13px] underline underline-offset-[3px]"
            onClick={() => {
              setSent(false)
              setEmail('')
            }}
          >
            essayer une autre adresse
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-[28px]">
      <BALabel>Ton email</BALabel>
      <input
        className="ba-input"
        type="email"
        name="email"
        placeholder="prenom@email.fr"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          setError(null)
        }}
        autoComplete="email"
        autoCapitalize="none"
        style={error ? { borderColor: 'var(--color-stamp)' } : undefined}
        disabled={pending}
      />
      {error && (
        <div className="ba-fade mt-[8px] text-[13px] text-stamp ml-[2px]">{error}</div>
      )}
      <div className="mt-[18px]">
        <BAPrimary type="submit" full disabled={pending}>
          {pending ? 'Une seconde…' : 'Renvoyer mon lien'}
        </BAPrimary>
      </div>
    </form>
  )
}
