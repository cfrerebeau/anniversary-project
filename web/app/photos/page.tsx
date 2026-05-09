import { requireGuest } from '@/lib/auth'
import { BAHeader } from '@/components/design/header'
import { BAPageTitle } from '@/components/design/page-title'
import { PageContainer } from '@/components/design/page-container'
import { PhotosUploader } from '@/components/photos/uploader'

export const dynamic = 'force-dynamic'

export default async function PhotosPage() {
  await requireGuest()
  return (
    <PageContainer width="normal">
      <div className="min-h-screen pt-[54px]">
        <BAHeader backHref="/" />
        <BAPageTitle
          eyebrow="02 · photos souvenirs"
          title="Tes vieilles photos d'eux."
          italicWord="vieilles"
          sub="Voyages, dîners, déguisements, mariages d'amis. Plus c'est vieux ou flou, mieux c'est. Promis, ça reste entre nous — jamais affiché publiquement."
        />
        <PhotosUploader />
      </div>
    </PageContainer>
  )
}
