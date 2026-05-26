import { IconArrow } from '@/components/design/icons'

const LARGE_ZIP_BYTES = 1.5 * 1024 ** 3
const ZIP_BUDGET_BYTES = 8 * 1024 ** 3 // doit matcher MAX_BYTES dans /api/cadeau/download-all/route.ts

export function DownloadZipButton({
  href,
  filename,
  count,
  totalBytes,
}: {
  href: string
  filename: string
  count: number
  totalBytes: number
}) {
  if (count === 0) {
    return (
      <div className="text-[12px] text-ink-mute">Pas encore de photo à télécharger.</div>
    )
  }
  if (totalBytes > ZIP_BUDGET_BYTES) {
    return (
      <div className="flex flex-col gap-[6px] items-start">
        <button
          type="button"
          disabled
          className="ba-btn rounded-[14px] px-[18px] py-[12px] text-[14px] bg-transparent text-ink-mute border border-paper-edge cursor-not-allowed"
        >
          Album trop volumineux
        </button>
        <div className="text-[11px] text-ink-mute leading-[1.4]">
          Trop volumineux pour un seul ZIP — contacte les admins.
        </div>
      </div>
    )
  }
  const heavy = totalBytes > LARGE_ZIP_BYTES
  return (
    <div className="flex flex-col gap-[6px] items-start">
      <a
        href={href}
        className="ba-btn rounded-[14px] px-[18px] py-[12px] text-[14px] font-semibold bg-ink text-paper inline-flex items-center gap-[8px]"
        style={{
          boxShadow:
            '0 1px 0 rgba(255,255,255,.12) inset, 0 6px 16px -8px rgba(21,35,59,.6)',
        }}
        download={filename}
      >
        Tout télécharger en ZIP
        <IconArrow size={14} />
      </a>
      {heavy && (
        <div className="text-[11px] text-ink-mute leading-[1.4]">
          Ça peut prendre quelques minutes — laisse l&apos;onglet ouvert.
        </div>
      )}
    </div>
  )
}
