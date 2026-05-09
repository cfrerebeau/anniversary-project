'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { BAStamp } from '@/components/design/buttons'
import { BACard } from '@/components/design/card'
import { BAEyebrow, BALabel } from '@/components/design/eyebrow'
import { BAStampIcon } from '@/components/design/stamp-icon'
import { submitCagnotteMessage } from '@/app/actions/cagnotte-message'

export function MessageForm({ defaultName }: { defaultName: string }) {
  const [name, setName] = useState(defaultName)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [pledged, setPledged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set('display_name', name.trim() || 'Un complice')
    const cents = Math.round((parseFloat(amount.replace(/\D/g, '')) || 0) * 100)
    if (cents > 0) fd.set('amount_cents', String(cents))
    fd.set('message', message)
    startTransition(async () => {
      const res = await submitCagnotteMessage(fd)
      if (res.ok) {
        setPledged(true)
      } else {
        setError(res.error)
      }
    })
  }

  if (pledged) {
    return (
      <div className="ba-fade">
        <BACard className="p-[22px] text-center">
          <div className="ba-pop inline-block">
            <BAStampIcon size={52} label="✓" />
          </div>
          <div className="font-serif text-[26px] mt-[14px] leading-[1.1]">
            Merci <em className="italic">{name}</em>.
          </div>
          <div className="text-[14px] text-ink-soft mt-[8px] leading-[1.5]">
            C&apos;est dans le compteur. Plus qu&apos;à virer le sous, quand tu veux.
          </div>
          <Link
            href="/merci?from=cagnotte"
            className="ba-btn inline-block bg-transparent text-ink mt-[14px] text-[13px] underline underline-offset-[3px] p-[6px]"
          >
            voir le mot complet →
          </Link>
        </BACard>
      </div>
    )
  }

  return (
    <>
      <BAEyebrow color="olive">Optionnel</BAEyebrow>
      <h3 className="font-serif text-[26px] m-0 mt-[6px] mb-[10px] leading-[1.1]">
        Laisse-nous un <em className="italic">mot</em>.
      </h3>
      <p className="text-[14px] text-ink-soft m-0 mb-[14px] leading-[1.5]">
        Pour qu&apos;on tienne le compte et qu&apos;on te dise merci correctement.
      </p>

      <form onSubmit={onSubmit}>
        <div className="mb-[12px]">
          <BALabel>Ton prénom</BALabel>
          <input
            className="ba-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="mb-[12px]">
          <BALabel>Montant (juste pour notre compteur)</BALabel>
          <div className="relative">
            <input
              className="ba-input"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="ex. 50"
              style={{ paddingRight: 36 }}
            />
            <span
              className="font-mono absolute text-ink-mute text-[16px]"
              style={{ right: 14, top: '50%', transform: 'translateY(-50%)' }}
            >
              €
            </span>
          </div>
        </div>
        <div className="mb-[16px]">
          <BALabel>Un message pour eux (ou pour nous)</BALabel>
          <textarea
            className="ba-input"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Allez, raconte."
            style={{ resize: 'none', fontFamily: 'inherit' }}
          />
        </div>
        {error && (
          <div className="ba-fade text-[13px] text-stamp mb-[10px]">{error}</div>
        )}
        <BAStamp full type="submit" disabled={pending}>
          {pending ? 'Une seconde…' : 'C\'est noté.'}
        </BAStamp>
      </form>
    </>
  )
}
