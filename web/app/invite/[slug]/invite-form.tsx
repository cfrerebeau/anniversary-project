'use client'

import { useId, useState, useTransition } from 'react'
import { BAPrimary } from '@/components/design/buttons'
import { BACard } from '@/components/design/card'
import { BALabel } from '@/components/design/eyebrow'
import { IconCheck } from '@/components/design/icons'
import { registerAndSignIn } from '@/app/actions/invite'

export function InviteForm({ slug }: { slug: string }) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<'email' | 'first_name' | null>(null)
  const [sentMessage, setSentMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const firstNameId = useId()
  const emailId = useId()
  const errorId = useId()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setErrorField(null)
    if (firstName.trim().length === 0) {
      setError('Mets un prénom.')
      setErrorField('first_name')
      return
    }
    if (!email.includes('@')) {
      setError("Cette adresse a l'air bancale.")
      setErrorField('email')
      return
    }
    const fd = new FormData()
    fd.set('slug', slug)
    fd.set('email', email)
    fd.set('first_name', firstName)
    startTransition(async () => {
      const result = await registerAndSignIn(fd)
      // En cas de succès "instant sign-in", l'action redirect()-e — on n'arrive
      // pas ici. Sinon on récupère un statut explicite.
      if (!result) return
      if (result.status === 'sent') {
        setSentMessage(result.message)
        return
      }
      setError(result.message)
      setErrorField(result.status === 'invalid' ? (result.field ?? null) : null)
    })
  }

  if (sentMessage) {
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
              <div className="text-[14px] text-ink-soft leading-[1.5]">{sentMessage}</div>
            </div>
          </div>
        </BACard>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-[28px]" noValidate>
      <label htmlFor={firstNameId} className="block">
        <BALabel>Ton prénom</BALabel>
      </label>
      <input
        id={firstNameId}
        className="ba-input"
        type="text"
        name="first_name"
        placeholder="Léa"
        value={firstName}
        onChange={(e) => {
          setFirstName(e.target.value)
          setError(null)
          setErrorField(null)
        }}
        autoComplete="given-name"
        autoCapitalize="words"
        maxLength={80}
        aria-invalid={errorField === 'first_name' || undefined}
        aria-describedby={error ? errorId : undefined}
        style={errorField === 'first_name' ? { borderColor: 'var(--color-stamp)' } : undefined}
        disabled={pending}
      />
      <div className="mt-[18px]">
        <label htmlFor={emailId} className="block">
          <BALabel>Ton email</BALabel>
        </label>
        <input
          id={emailId}
          className="ba-input"
          type="email"
          name="email"
          placeholder="prenom@email.fr"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null)
            setErrorField(null)
          }}
          autoComplete="email"
          autoCapitalize="none"
          aria-invalid={errorField === 'email' || undefined}
          aria-describedby={error ? errorId : undefined}
          style={errorField === 'email' ? { borderColor: 'var(--color-stamp)' } : undefined}
          disabled={pending}
        />
      </div>
      {error && (
        <div
          id={errorId}
          role="alert"
          className="ba-fade mt-[8px] text-[13px] text-stamp ml-[2px]"
        >
          {error}
        </div>
      )}
      <div className="mt-[18px]">
        <BAPrimary type="submit" full disabled={pending}>
          {pending ? 'Une seconde…' : 'Entrer'}
        </BAPrimary>
      </div>
    </form>
  )
}
