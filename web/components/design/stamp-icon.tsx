export function BAStampIcon({ size = 38, label = 'B&A' }: { size?: number; label?: string }) {
  return (
    <div
      className="bg-stamp text-paper inline-flex items-center justify-center font-serif italic relative shrink-0"
      style={{
        width: size,
        height: size * 1.12,
        fontSize: size * 0.42,
        borderRadius: 2,
        boxShadow: '0 4px 10px -4px rgba(184,84,59,.5)',
      }}
    >
      <span className="relative z-10">{label}</span>
      {/* Perforations bord postal */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: -4,
          backgroundImage:
            'radial-gradient(circle 3px at 0 0, var(--color-paper) 99%, transparent 100%)',
          backgroundSize: '6px 6px',
          backgroundPosition: '-3px -3px',
        }}
      />
    </div>
  )
}
