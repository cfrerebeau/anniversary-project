type Width = 'narrow' | 'normal' | 'wide'

const widthClass: Record<Width, string> = {
  narrow: 'max-w-md',     // ~448px — formulaires (/access)
  normal: 'max-w-2xl',    // ~672px — pages standard
  wide: 'max-w-6xl',      // ~1152px — pages avec grid 2-col (/, /cagnotte)
}

/**
 * Wrapper qui contraint la largeur du contenu sur desktop sans toucher au
 * mobile. Toutes les pages devraient passer par ici.
 */
export function PageContainer({
  children,
  width = 'normal',
  className = '',
}: {
  children: React.ReactNode
  width?: Width
  className?: string
}) {
  return (
    <div className={`mx-auto w-full ${widthClass[width]} md:px-8 lg:px-12 ${className}`}>
      {children}
    </div>
  )
}
