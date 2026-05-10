'use client'

import { useState } from 'react'
import { BACard } from '@/components/design/card'
import { BAEyebrow } from '@/components/design/eyebrow'
import { IconArrow, IconCheck, IconCopy, IconFile } from '@/components/design/icons'

type Row = { label: string; value: string; key: 'beneficiary' | 'iban' | 'bic' }

export function IbanCard({
  iban,
  bic,
  defaultReference = '',
  beneficiary,
}: {
  iban: string
  bic: string
  defaultReference?: string
  beneficiary?: string
}) {
  const rows: Row[] = [
    ...(beneficiary
      ? [{ label: 'Bénéficiaire', value: beneficiary, key: 'beneficiary' as const }]
      : []),
    { label: 'IBAN', value: iban, key: 'iban' },
    { label: 'BIC', value: bic, key: 'bic' },
  ]
  type CopyKey = Row['key'] | 'ref'
  const [copied, setCopied] = useState<CopyKey | null>(null)
  const [reference, setReference] = useState(defaultReference)

  function copy(key: CopyKey, value: string) {
    if (!value) return
    if (navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {})
    }
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <BACard className="p-0 overflow-hidden">
      <div className="px-[20px] pt-[18px] pb-[14px] border-b border-dashed border-paper-edge">
        <BAEyebrow>Coordonnées</BAEyebrow>
        <div className="font-serif text-[22px] mt-[4px]">Vire-le ici.</div>
      </div>

      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-center gap-[12px] px-[20px] py-[14px] border-b border-paper-edge"
        >
          <div className="flex-1 min-w-0">
            <div
              className="text-[11px] text-ink-mute uppercase mb-[4px]"
              style={{ letterSpacing: '0.04em' }}
            >
              {row.label}
            </div>
            <div
              className="font-mono text-[14px] text-ink whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ letterSpacing: '0.02em' }}
            >
              {row.value || '—'}
            </div>
          </div>
          <button
            type="button"
            className="ba-btn rounded-[10px] py-[10px] px-[12px] text-[13px] font-medium flex items-center gap-[6px] justify-center"
            style={{
              minWidth: 88,
              background:
                copied === row.key ? 'rgba(94,122,82,.14)' : 'var(--color-paper)',
              color: copied === row.key ? 'var(--color-success)' : 'var(--color-ink)',
              border: `1px solid ${copied === row.key ? 'rgba(94,122,82,.3)' : 'var(--color-paper-edge)'}`,
            }}
            onClick={() => copy(row.key, row.value)}
            disabled={!row.value}
            aria-label={`copier ${row.label}`}
          >
            {copied === row.key ? (
              <>
                <IconCheck size={14} /> copié
              </>
            ) : (
              <>
                <IconCopy size={14} /> copier
              </>
            )}
          </button>
        </div>
      ))}

      <div className="flex items-center gap-[12px] px-[20px] py-[14px]">
        <div className="flex-1 min-w-0">
          <div
            className="text-[11px] text-ink-mute uppercase mb-[4px]"
            style={{ letterSpacing: '0.04em' }}
          >
            Référence (ton nom, ou « Cadeau BA »)
          </div>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Ton nom — ou Cadeau BA"
            className="font-mono text-[14px] text-ink bg-transparent border-0 p-0 w-full outline-none focus:ring-0 placeholder:text-ink-mute"
            style={{ letterSpacing: '0.02em' }}
            aria-label="Référence du virement"
          />
        </div>
        <button
          type="button"
          className="ba-btn rounded-[10px] py-[10px] px-[12px] text-[13px] font-medium flex items-center gap-[6px] justify-center"
          style={{
            minWidth: 88,
            background:
              copied === 'ref' ? 'rgba(94,122,82,.14)' : 'var(--color-paper)',
            color: copied === 'ref' ? 'var(--color-success)' : 'var(--color-ink)',
            border: `1px solid ${copied === 'ref' ? 'rgba(94,122,82,.3)' : 'var(--color-paper-edge)'}`,
          }}
          onClick={() => copy('ref', reference.trim())}
          disabled={!reference.trim()}
          aria-label="copier la référence"
        >
          {copied === 'ref' ? (
            <>
              <IconCheck size={14} /> copié
            </>
          ) : (
            <>
              <IconCopy size={14} /> copier
            </>
          )}
        </button>
      </div>

      {/* RIB téléchargeable — preuve d'ownership délivrée par Wise */}
      <a
        href="/rib.pdf"
        target="_blank"
        rel="noopener"
        className="ba-btn flex items-center gap-[10px] py-[14px] px-[16px] border-t border-paper-edge text-ink hover:bg-paper-deep"
        style={{ background: 'rgba(94,122,82,.06)' }}
      >
        <div className="text-olive shrink-0" aria-hidden>
          <IconFile size={18} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-[13px] font-medium">Voir le RIB officiel</div>
          <div className="text-[11px] text-ink-mute">
            Preuve d&apos;ownership délivrée par Wise (PDF)
          </div>
        </div>
        <IconArrow size={14} className="text-ink-mute" />
      </a>
    </BACard>
  )
}
