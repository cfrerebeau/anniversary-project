'use client'

import { useState, useTransition } from 'react'
import { BAPrimary } from '@/components/design/buttons'
import { BACard } from '@/components/design/card'
import { BALabel } from '@/components/design/eyebrow'
import { addGuest, type AddGuestResult } from '@/app/actions/admin/add-guest'

export function AddGuestForm() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [result, setResult] = useState<AddGuestResult | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResult(null)
    const fd = new FormData()
    fd.set('email', email)
    if (fullName.trim()) fd.set('full_name', fullName)
    startTransition(async () => {
      const r = await addGuest(fd)
      setResult(r)
      if (r.status === 'ok') {
        setEmail('')
        setFullName('')
      }
    })
  }

  const isError = result && result.status !== 'ok'

  return (
    <BACard className="p-[22px]">
      <div className="font-serif text-[22px] leading-[1.1] mb-[4px]">Ajouter un invité</div>
      <div className="text-[13px] text-ink-soft leading-[1.5] mb-[18px]">
        Insère la ligne dans `guests`. À toi de prévenir l&apos;invité d&apos;aller sur{' '}
        <span className="font-mono">/access</span> pour recevoir son lien.
      </div>

      <form onSubmit={onSubmit}>
        <BALabel>Email</BALabel>
        <input
          className="ba-input"
          type="email"
          name="email"
          placeholder="prenom@email.fr"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setResult(null)
          }}
          autoComplete="off"
          autoCapitalize="none"
          required
          disabled={pending}
          style={isError ? { borderColor: 'var(--color-stamp)' } : undefined}
        />

        <div className="mt-[14px]">
          <BALabel>Prénom et nom (optionnel)</BALabel>
          <input
            className="ba-input"
            type="text"
            name="full_name"
            placeholder="Alice Dupont"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="off"
            disabled={pending}
          />
        </div>

        {result && (
          <div
            className={`ba-fade mt-[12px] text-[13px] ml-[2px] ${
              result.status === 'ok' ? 'text-success' : 'text-stamp'
            }`}
          >
            {result.message}
          </div>
        )}

        <div className="mt-[18px]">
          <BAPrimary type="submit" full disabled={pending || !email}>
            {pending ? 'Une seconde…' : 'Ajouter'}
          </BAPrimary>
        </div>
      </form>
    </BACard>
  )
}
