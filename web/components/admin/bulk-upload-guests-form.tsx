'use client'

import { useState, useTransition } from 'react'
import { BAPrimary } from '@/components/design/buttons'
import { BACard } from '@/components/design/card'
import { BALabel } from '@/components/design/eyebrow'
import {
  bulkUploadGuests,
  type BulkUploadResult,
} from '@/app/actions/admin/bulk-upload-guests'

const MAX_INVALID_DISPLAYED = 5

export function BulkUploadGuestsForm() {
  const [csv, setCsv] = useState('')
  const [result, setResult] = useState<BulkUploadResult | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResult(null)
    const fd = new FormData()
    fd.set('csv', csv)
    startTransition(async () => {
      const r = await bulkUploadGuests(fd)
      setResult(r)
      if (r.status === 'ok' && r.imported > 0) {
        setCsv('')
      }
    })
  }

  const isError = result && result.status !== 'ok'
  const extraInvalid =
    result && result.invalidRows.length > MAX_INVALID_DISPLAYED
      ? result.invalidRows.length - MAX_INVALID_DISPLAYED
      : 0

  return (
    <BACard className="p-[22px]">
      <div className="font-serif text-[22px] leading-[1.1] mb-[4px]">
        Importer un CSV
      </div>
      <div className="text-[13px] text-ink-soft leading-[1.5] mb-[18px]">
        Colle un CSV avec l&apos;en-tête{' '}
        <span className="font-mono">email,firstname</span>. Les emails déjà
        présents sont ignorés silencieusement.
      </div>

      <form onSubmit={onSubmit}>
        <BALabel>CSV</BALabel>
        <textarea
          className="ba-input font-mono text-[13px]"
          name="csv"
          placeholder={'email,firstname\nadrien.regnier@gmail.com,adrien'}
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value)
            setResult(null)
          }}
          rows={8}
          disabled={pending}
          style={{
            minHeight: 140,
            resize: 'vertical',
            ...(isError ? { borderColor: 'var(--color-stamp)' } : {}),
          }}
          required
        />

        {result && (
          <div
            className={`ba-fade mt-[12px] text-[13px] ml-[2px] ${
              result.status === 'ok' ? 'text-success' : 'text-stamp'
            }`}
          >
            {result.message}
          </div>
        )}

        {result && result.invalidRows.length > 0 && (
          <ul className="ba-fade mt-[8px] text-[12px] ml-[2px] text-stamp font-mono leading-[1.5]">
            {result.invalidRows.slice(0, MAX_INVALID_DISPLAYED).map((row) => (
              <li key={row.line}>
                ligne {row.line} — {row.reason}
              </li>
            ))}
            {extraInvalid > 0 && <li>…et {extraInvalid} autres.</li>}
          </ul>
        )}

        <div className="mt-[18px]">
          <BAPrimary type="submit" full disabled={pending || !csv.trim()}>
            {pending ? 'Une seconde…' : 'Importer'}
          </BAPrimary>
        </div>
      </form>
    </BACard>
  )
}
