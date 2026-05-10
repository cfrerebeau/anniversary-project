import { BAEyebrow } from './eyebrow'

export function BAPageTitle({
  eyebrow,
  title,
  italicWord,
  sub,
}: {
  eyebrow?: string
  title: string
  italicWord?: string
  sub?: React.ReactNode
}) {
  let display: React.ReactNode = title
  if (italicWord && title.includes(italicWord)) {
    const [before, after] = title.split(italicWord)
    display = (
      <>
        {before}
        <em className="italic">{italicWord}</em>
        {after}
      </>
    )
  }

  return (
    <div className="px-[22px] pt-[4px] pb-[16px]">
      {eyebrow && <BAEyebrow>{eyebrow}</BAEyebrow>}
      <h1
        className="font-serif text-[38px] leading-[1.05] text-ink tracking-[-0.01em] my-[6px] mb-[8px]"
        style={{ textWrap: 'pretty' }}
      >
        {display}
      </h1>
      {sub && (
        <div className="text-ink-soft text-[16px] leading-[1.45]" style={{ textWrap: 'pretty' }}>
          {sub}
        </div>
      )}
    </div>
  )
}
