import Link from 'next/link'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'

export const metadata = {
  title: 'Confidentialité',
}

export default function ConfidentialitePage() {
  return (
    <PageContainer width="normal">
    <div className="min-h-screen pt-[54px]">
      <BAHeader backHref="/" />
      <BAPageTitle
        eyebrow="rgpd"
        title="Politique de confidentialité."
        italicWord="confidentialité"
      />

      <div className="px-[22px] pb-[40px] text-[15px] leading-[1.6] text-ink-soft space-y-[18px]">
        <section>
          <h2 className="font-serif text-[20px] text-ink mb-[6px]">Données collectées</h2>
          <ul className="list-disc list-inside space-y-[4px]">
            <li>
              <strong className="text-ink">Email</strong> : pour t&apos;envoyer ton lien d&apos;accès
              et, optionnellement, des résumés.
            </li>
            <li>
              <strong className="text-ink">Prénom / nom</strong> : pour personnaliser le site.
            </li>
            <li>
              <strong className="text-ink">Questions de quizz, photos, messages</strong> : ce que
              tu déposes volontairement sur le site.
            </li>
            <li>
              <strong className="text-ink">Empreinte d&apos;IP (hashée)</strong> : pour limiter
              les abus (rate-limit). L&apos;IP en clair n&apos;est jamais stockée.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-[20px] text-ink mb-[6px]">Finalité</h2>
          <p>
            Coordonner un cadeau collectif et préparer la fête. Aucune donnée n&apos;est cédée à un
            tiers, ni utilisée à des fins commerciales.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[20px] text-ink mb-[6px]">Durée de conservation</h2>
          <p>
            Les données sont supprimées au plus tard 180 jours après la date du mariage, sauf
            demande contraire explicite des organisateurs.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[20px] text-ink mb-[6px]">Hébergement & sous-traitants</h2>
          <p>
            Hébergement applicatif : Vercel (États-Unis). Base de données et stockage : Supabase
            (Union européenne, région Irlande). Email transactionnel (si activé) : Resend.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-[20px] text-ink mb-[6px]">Tes droits</h2>
          <p>
            Tu peux à tout moment demander la suppression de tes données (questions, photos,
            messages, email) en répondant à l&apos;email d&apos;invitation que tu as reçu.
          </p>
        </section>

        <p className="pt-[12px]">
          Voir aussi les{' '}
          <Link href="/mentions-legales" className="text-ink underline underline-offset-[3px]">
            mentions légales
          </Link>
          .
        </p>
      </div>
    </div>
    </PageContainer>
  )
}
