type IconProps = { size?: number; className?: string }

export const IconCopy = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
    <rect x="4" y="4" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M3 11V3a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)

export const IconCheck = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
    <path d="M3 8.5L6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconArrow = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconPlus = ({ size = 18, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" className={className} aria-hidden>
    <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

export const IconUpload = ({ size = 28, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className={className} aria-hidden>
    <path d="M14 18V5m0 0l-5 5m5-5l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 19v3a2 2 0 002 2h14a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

export const IconBack = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
    <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconFile = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
    <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5l-4-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M9 1v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
)
