'use client'

import { useState, useTransition } from 'react'
import { updateGuestName } from '@/app/actions/admin/update-guest'

/**
 * Cellule "nom" éditable inline. Click sur le nom (ou sur "—") pour passer en
 * mode édition. Enter ou bouton "ok" pour sauver, Esc ou clic ailleurs pour
 * annuler. Le bouton primaire `Sauver` ne s'active que si la valeur a changé.
 */
export function EditableGuestName({
  guestId,
  initialName,
  email,
}: {
  guestId: string
  initialName: string | null
  email: string
}) {
  const [name, setName] = useState<string>(initialName ?? '')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string | null>(initialName)
  const [pending, startTransition] = useTransition()

  function start() {
    setName(savedName ?? '')
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setName(savedName ?? '')
    setError(null)
    setEditing(false)
  }

  function save() {
    const next = name.trim() || null
    if (next === savedName) {
      setEditing(false)
      return
    }
    const fd = new FormData()
    fd.set('guestId', guestId)
    if (next !== null) fd.set('full_name', next)
    startTransition(async () => {
      const r = await updateGuestName(fd)
      if (r.status === 'ok') {
        setSavedName(next)
        setEditing(false)
        setError(null)
      } else {
        setError(r.message)
      }
    })
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        className="ba-btn bg-transparent text-ink p-0 text-left"
        title="Modifier"
        aria-label={`Modifier le nom de ${email}`}
      >
        <div className="font-medium underline-offset-[3px] hover:underline">
          {savedName ?? <span className="text-ink-mute">—</span>}
        </div>
        <div className="text-ink-soft text-[12px]">{email}</div>
      </button>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-[6px]">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
          }}
          disabled={pending}
          placeholder="Prénom Nom"
          className="ba-input"
          style={{ padding: '6px 10px', fontSize: 13, height: 32 }}
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="ba-btn bg-ink text-paper rounded-[6px] text-[12px] font-semibold"
          style={{ padding: '6px 10px', height: 32 }}
        >
          {pending ? '…' : 'ok'}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="ba-btn bg-transparent text-ink-soft text-[12px]"
          style={{ padding: '6px 6px', height: 32 }}
        >
          annuler
        </button>
      </div>
      <div className="text-ink-soft text-[12px] mt-[2px]">{email}</div>
      {error && <div className="text-stamp text-[12px] mt-[2px]">{error}</div>}
    </div>
  )
}
