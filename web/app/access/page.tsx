import type { Metadata } from 'next'
import { PageContainer } from '@/components/design/page-container'
import { AccessForm } from './access-form'

// Metadata locale pour /access — ultra-générique. Aucun signe distinctif.
export const metadata: Metadata = {
  title: 'Petit projet',
  description: 'Projet privé.',
  robots: { index: false, follow: false },
}

export default function AccessPage() {
  return (
    <PageContainer width="narrow">
      <div className="min-h-screen flex flex-col px-[24px] pt-[64px] pb-[24px]">
        <div className="flex-1">
          <div className="font-mono text-[11px] tracking-[0.2em] text-ink-mute uppercase">
            Accès privé
          </div>
          <h1
            className="font-serif text-[36px] leading-[1.05] mt-[12px] mb-[12px] text-ink tracking-[-0.01em]"
          >
            Petit projet <em className="italic">privé.</em>
          </h1>
          <p
            className="text-ink-soft text-[16px] leading-[1.5] m-0"
            style={{ textWrap: 'pretty' }}
          >
            Si tu as reçu un email avec un lien, c&apos;est par là qu&apos;on entre. Sinon, laisse
            ton adresse — on vérifie et on te le renvoie.
          </p>

          <AccessForm />
        </div>

        <div className="pt-[18px] text-[12px] text-ink-mute text-center leading-[1.5]">
          Pas de compte à créer. Pas de mot de passe.
        </div>
      </div>
    </PageContainer>
  )
}
