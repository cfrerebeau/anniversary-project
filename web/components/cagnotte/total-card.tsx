import { BACard } from '@/components/design/card'

export function TotalCard({
  totalCents,
  contributorsCount,
}: {
  totalCents: number
  contributorsCount: number
}) {
  const euros = Math.round(totalCents / 100)
  return (
    <BACard tone="deep" className="p-[22px] relative overflow-hidden">
      <div className="font-mono text-[10px] text-stamp tracking-[0.18em] uppercase">
        Compteur en direct
      </div>
      <div className="font-serif text-[56px] leading-none mt-[8px]">
        {euros.toLocaleString('fr-FR')}{' '}
        <span className="text-[32px] text-ink-soft">€</span>
      </div>
      <div className="text-[13px] text-ink-soft mt-[6px]">
        {contributorsCount > 0
          ? `${contributorsCount} ${contributorsCount > 1 ? 'personnes ont' : 'personne a'} déjà mis quelque chose. Pas de classement, promis.`
          : "Personne n'a encore mis. C'est l'occasion d'ouvrir le bal!"}
      </div>
      <div
        className="mt-[14px] h-[4px] rounded-[2px] overflow-hidden"
        style={{ background: 'rgba(21,35,59,.08)' }}
      >
        <div
          className="h-full bg-olive rounded-[2px] transition-all"
          style={{ width: contributorsCount > 0 ? '38%' : '4%' }}
        />
      </div>
    </BACard>
  )
}
