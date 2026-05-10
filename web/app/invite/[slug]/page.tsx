import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageContainer } from '@/components/design/page-container'
import { checkInviteSlug } from '@/lib/invite'
import { InviteForm } from './invite-form'

export const metadata: Metadata = {
  title: 'Petit projet',
  description: 'Projet privé.',
  robots: { index: false, follow: false },
  // Empêche le slug de fuiter dans le Referer vers d'autres origines (ou même
  // vers /access via le lien de la vue "expirée").
  referrer: 'no-referrer',
}

export const dynamic = 'force-dynamic'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const status = checkInviteSlug(slug)
  if (status === 'wrong_slug') notFound()

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
          {status === 'expired' ? (
            <p
              className="text-ink-soft text-[16px] leading-[1.5] m-0"
              style={{ textWrap: 'pretty' }}
            >
              Ce lien d&apos;invitation est expiré. Si tu as déjà un accès, tu peux te reconnecter
              depuis <a className="underline" href="/access">la page d&apos;accès</a>.
            </p>
          ) : (
            <>
              <p
                className="text-ink-soft text-[16px] leading-[1.5] m-0"
                style={{ textWrap: 'pretty' }}
              >
                Dis-nous qui tu es — on note ton prénom et ton email pour te reconnaître la
                prochaine fois.
              </p>
              <InviteForm slug={slug} />
            </>
          )}
        </div>

        <div className="pt-[18px] text-[12px] text-ink-mute text-center leading-[1.5]">
          Pas de compte à créer. Pas de mot de passe.
        </div>
      </div>
    </PageContainer>
  )
}
