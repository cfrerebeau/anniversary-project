import { BACard } from '@/components/design/card'

type MessageRow = {
  id: string
  display_name: string | null
  message: string | null
  created_at: string
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function MessagesPanel({ messages }: { messages: MessageRow[] }) {
  if (messages.length === 0) {
    return (
      <div className="px-[22px] py-[40px] text-center text-ink-mute">
        Pas encore de mot pour vous.
      </div>
    )
  }

  return (
    <div className="px-[22px] flex flex-col gap-[14px]">
      {messages.map((m) => (
        <BACard key={m.id} className="p-[20px]">
          <div className="font-serif text-[20px] leading-[1.15]">
            {m.display_name ?? '—'}
          </div>
          {m.message && (
            <div className="mt-[10px] text-[14px] leading-[1.5] whitespace-pre-wrap">
              {m.message}
            </div>
          )}
          <div className="mt-[12px] pt-[10px] border-t border-paper-edge font-mono text-[10px] tracking-[0.1em] uppercase text-ink-mute">
            {dateFmt.format(new Date(m.created_at))}
          </div>
        </BACard>
      ))}
    </div>
  )
}
