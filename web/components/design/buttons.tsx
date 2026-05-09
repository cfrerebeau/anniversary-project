import { type ButtonHTMLAttributes, type ReactNode } from 'react'

type Common = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode
  full?: boolean
}

export function BAPrimary({ children, full = false, className = '', ...props }: Common) {
  return (
    <button
      {...props}
      className={`ba-btn bg-ink text-paper rounded-[14px] px-[22px] py-[15px] text-[16px] font-semibold tracking-[-0.01em] ${full ? 'w-full' : ''} ${className}`}
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,.12) inset, 0 6px 16px -8px rgba(21,35,59,.6)', ...(props.style || {}) }}
    >
      {children}
    </button>
  )
}

export function BASecondary({ children, full = false, className = '', ...props }: Common) {
  return (
    <button
      {...props}
      className={`ba-btn bg-transparent text-ink border-[1.5px] border-ink rounded-[14px] px-[20px] py-[13.5px] text-[16px] font-semibold ${full ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

type StampProps = Common & { color?: 'stamp' | 'olive' | 'gold' }
const stampPalette: Record<NonNullable<StampProps['color']>, string> = {
  stamp: 'bg-stamp',
  olive: 'bg-olive',
  gold: 'bg-gold',
}

export function BAStamp({ children, full = false, color = 'stamp', className = '', ...props }: StampProps) {
  return (
    <button
      {...props}
      className={`ba-btn ${stampPalette[color]} text-paper rounded-[14px] px-[22px] py-[15px] text-[16px] font-semibold ${full ? 'w-full' : ''} ${className}`}
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,.18) inset, 0 6px 18px -8px rgba(184,84,59,.6)', ...(props.style || {}) }}
    >
      {children}
    </button>
  )
}
