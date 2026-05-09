'use client'

import { useState } from 'react'
import { BACard } from '@/components/design/card'
import { BAEyebrow } from '@/components/design/eyebrow'
import { IconArrow, IconCheck, IconCopy, IconFile } from '@/components/design/icons'

type Row = { label: string; value: string; key: 'iban' | 'bic' | 'ref' }

export function IbanCard({ iban, bic, reference }: { iban: string; bic: string; reference: string }) {
  const rows: Row[] = [
    { label: 'IBAN', value: iban, key: 'iban' },
    { label: 'BIC', value: bic, key: 'bic' },
    { label: 'Référence (important)', value: reference, key: 'ref' },
  ]
  const [copied, setCopied] = useState<Row['key'] | null>(null)

  function copy(row: Row) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(row.value).catch(() => {})
    }
    setCopied(row.key)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <BACard className="p-0 overflow-hidden">
      <div className="px-[20px] pt-[18px] pb-[14px] border-b border-dashed border-paper-edge">
        <BAEyebrow>Coordonnées</BAEyebrow>
        <div className="font-serif text-[22px] mt-[4px]">Vire-le ici.</div>
      </div>

      {rows.map((row, i) => (
        <div
          key={row.key}
          className={`flex items-center gap-[12px] px-[20px] py-[14px] ${
            i < rows.length - 1 ? 'border-b border-paper-edge' : ''
          }`}
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
            onClick={() => copy(row)}
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

      <div
        className="p-[16px] flex gap-[10px]"
        style={{ background: 'rgba(184,146,76,.08)' }}
      >
        <div className="text-[18px]" aria-hidden>📌</div>
        <div className="text-[13px] text-ink-soft leading-[1.45]">
          N&apos;oublie pas la <strong className="text-ink">référence</strong>, sinon on ne saura
          pas que c&apos;est toi.
        </div>
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
