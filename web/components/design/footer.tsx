import { formatDateFR } from '@/lib/format'

export function BAFooter() {
  const weddingISO = process.env.NEXT_PUBLIC_WEDDING_DATE
  const date = weddingISO ? formatDateFR(new Date(weddingISO), { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const whatsappUrl = process.env.NEXT_PUBLIC_WHATSAPP_URL

  return (
    <div className="px-[22px] pt-[24px] pb-[30px] text-center">
      <div className="font-mono text-[10px] text-ink-mute tracking-[0.18em] uppercase">
        le mariage · {date}
      </div>
      <div className="text-[12px] text-ink-mute mt-[8px] leading-[1.5]">
        Ce site est une surprise. Pas un mot. <span className="whitespace-nowrap">🤫</span>
      </div>
      {whatsappUrl && (
        <div className="text-[12px] text-ink-mute mt-[6px] leading-[1.5]">
          Un pépin ?{' '}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-[3px]"
          >
            Le groupe WhatsApp.
          </a>
        </div>
      )}
    </div>
  )
}
