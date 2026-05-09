import type { CSSProperties, ReactNode } from 'react'

type CardTone = 'paper' | 'deep' | 'ink'

const toneClass: Record<CardTone, string> = {
  paper: 'bg-paper-soft text-ink border-paper-edge',
  deep: 'ba-paper-deep text-ink border-paper-edge',
  ink: 'bg-ink text-paper border-white/10',
}

export function BACard({
  children,
  tone = 'paper',
  className = '',
  style,
}: {
  children: ReactNode
  tone?: CardTone
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`rounded-[18px] border ${toneClass[tone]} ${className}`}
      style={{
        boxShadow: '0 1px 0 rgba(21,35,59,.04), 0 12px 32px -18px rgba(76,50,30,.25)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
