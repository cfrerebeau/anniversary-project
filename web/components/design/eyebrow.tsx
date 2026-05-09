import type { ReactNode } from 'react'

const colorClass = {
  stamp: 'text-stamp',
  olive: 'text-olive',
  ink: 'text-ink-mute',
} as const

export function BAEyebrow({
  children,
  color = 'stamp',
}: {
  children: ReactNode
  color?: keyof typeof colorClass
}) {
  return (
    <div
      className={`font-mono text-[11px] tracking-[0.16em] uppercase font-medium ${colorClass[color]}`}
    >
      {children}
    </div>
  )
}

export function BALabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[13px] text-ink-soft font-medium mb-[6px] ml-[2px]">{children}</div>
  )
}
