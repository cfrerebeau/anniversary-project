import Link from 'next/link'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'

export const metadata = {
  title: 'Mentions légales',
}

export default function MentionsLegalesPage() {
  return (
    <PageContainer width="normal">
    <div className="min-h-screen pt-[54px]">
      <BAHeader backHref="/" />
      <BAPageTitle eyebrow="cadre légal" title="Mentions légales." italicWord="légales" />

      <div className="px-[22px] pb-[40px] text-[15px] leading-[1.6] text-ink-soft space-y-[16px]">
        <section>
          <h2 className="font-serif text-[20px] text-ink mb-[6px]">Éditeur du site</h2>
          <p>
            Site édité à titre privé et non commercial par un groupe d&apos;amis du couple
            organisant ce projet. Pas de raison sociale, pas de SIREN — c&apos;est un site personnel
            sans activité économique.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[20px] text-ink mb-[6px]">Hébergement</h2>
          <p>
            Hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[20px] text-ink mb-[6px]">Contact</h2>
          <p>
            Pour toute question relative à ce site (suppression de données, signalement d&apos;un
            problème), écris à l&apos;adresse fournie dans l&apos;email d&apos;invitation que tu
            as reçu.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[20px] text-ink mb-[6px]">Propriété intellectuelle</h2>
          <p>
            Les contenus (photos, textes) déposés sur ce site appartiennent à leurs auteurs
            respectifs. Ils sont collectés à des fins privées et non destinés à une diffusion
            publique.
          </p>
        </section>

        <p className="pt-[12px]">
          Voir aussi la{' '}
          <Link href="/confidentialite" className="text-ink underline underline-offset-[3px]">
            politique de confidentialité
          </Link>
          .
        </p>
      </div>
    </div>
    </PageContainer>
  )
}
