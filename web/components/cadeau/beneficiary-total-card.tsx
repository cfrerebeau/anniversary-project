import { BACard } from '@/components/design/card'

export function BeneficiaryTotalCard({ totalCents }: { totalCents: number }) {
  const euros = Math.round(totalCents / 100)
  return (
    <BACard tone="deep" className="p-[22px] relative overflow-hidden">
      <div className="font-mono text-[10px] text-stamp tracking-[0.18em] uppercase">
        Votre cagnotte
      </div>
      <div className="font-serif text-[56px] leading-none mt-[8px]">
        {euros.toLocaleString('fr-FR')}{' '}
        <span className="text-[32px] text-ink-soft">€</span>
      </div>
      <div className="text-[13px] text-ink-soft mt-[6px]">
        Rassemblé par vos proches pour le voyage Toussaint.
      </div>
    </BACard>
  )
}
