import Link from 'next/link'
import { IconBack } from './icons'

export function BAHeader({ backHref = '/', label = 'cabanon' }: { backHref?: string; label?: string }) {
  return (
    <div className="flex items-center justify-between px-[18px] pt-[8px] pb-[4px] min-h-[44px]">
      <Link
        href={backHref}
        className="ba-btn flex items-center gap-[6px] bg-transparent text-ink-soft py-[6px] px-[8px] -ml-[8px] text-[15px] rounded-lg"
        aria-label="retour"
      >
        <IconBack size={16} />
        <span className="text-[14px]">{label}</span>
      </Link>
      <div className="font-mono text-[10px] tracking-[0.18em] text-ink-mute uppercase">
        🤫 entre nous
      </div>
      <div className="w-[60px]" aria-hidden />
    </div>
  )
}
