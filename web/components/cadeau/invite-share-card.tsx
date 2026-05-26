'use client'

import { useState } from 'react'
import { BACard } from '@/components/design/card'
import { BAEyebrow } from '@/components/design/eyebrow'

export function InviteShareCard({
  inviteUrl,
  expiresAtISO,
}: {
  inviteUrl: string
  expiresAtISO: string
}) {
  const [copied, setCopied] = useState(false)
  const dateLabel = new Date(expiresAtISO).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Fallback : selectionner pour copie manuelle.
      const ta = document.createElement('textarea')
      ta.value = inviteUrl
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      } catch {}
      ta.remove()
    }
  }

  return (
    <BACard className="p-[20px]">
      <BAEyebrow color="olive">Inviter quelqu&apos;un</BAEyebrow>
      <div className="mt-[8px] font-serif text-[20px] leading-[1.15]">
        Un proche manque à l&apos;album&nbsp;?
      </div>
      <div className="mt-[8px] text-[14px] text-ink-soft leading-[1.45]">
        Partage ce lien — il leur permet de se connecter et de voir/déposer leurs photos.
      </div>
      <div className="mt-[14px] flex flex-col sm:flex-row gap-[10px] items-stretch">
        <input
          readOnly
          value={inviteUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 bg-paper-soft border border-paper-edge rounded-[10px] px-[12px] py-[10px] font-mono text-[12px] text-ink"
        />
        <button
          type="button"
          onClick={onCopy}
          className="ba-btn bg-ink text-paper rounded-[10px] px-[16px] py-[10px] text-[13px] font-semibold"
        >
          {copied ? 'Copié !' : 'Copier le lien'}
        </button>
      </div>
      <div className="mt-[8px] text-[12px] text-ink-mute">
        Valable jusqu&apos;au {dateLabel}.
      </div>
    </BACard>
  )
}
