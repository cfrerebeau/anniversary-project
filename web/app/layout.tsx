import type { Metadata, Viewport } from 'next'
import { Public_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
})

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'Petit projet',
  description: 'Projet privé.',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  openGraph: { title: 'Petit projet', description: 'Projet privé.' },
}

export const viewport: Viewport = {
  themeColor: '#DDE6C5',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${publicSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="ba-paper min-h-full text-ink">{children}</body>
    </html>
  )
}
