import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Cadeau',
  description: 'Page privée.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function CadeauLayout({ children }: { children: ReactNode }) {
  return children
}
