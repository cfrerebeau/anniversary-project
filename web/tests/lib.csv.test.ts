import { describe, it, expect } from 'vitest'
import { csvCell, csvRow } from '@/lib/csv'

describe('csvCell', () => {
  it('renvoie une cellule vide pour null/undefined/string vide', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell('')).toBe('')
  })

  it('wrappe un texte simple entre guillemets', () => {
    expect(csvCell('hello')).toBe('"hello"')
  })

  it('double les guillemets internes (RFC 4180)', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('préserve les newlines à l\'intérieur de la cellule', () => {
    expect(csvCell('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"')
  })

  it('préserve les accents', () => {
    expect(csvCell('café à côté')).toBe('"café à côté"')
  })

  it('neutralise = en début de cellule (formule Excel)', () => {
    expect(csvCell('=HYPERLINK("https://evil","x")')).toBe(
      '"\'=HYPERLINK(""https://evil"",""x"")"',
    )
  })

  it('neutralise + en début de cellule', () => {
    expect(csvCell('+SUM(1,2)')).toBe('"\'+SUM(1,2)"')
  })

  it('neutralise - en début de cellule', () => {
    expect(csvCell('-1+1')).toBe('"\'-1+1"')
  })

  it('neutralise @ en début de cellule', () => {
    expect(csvCell('@evil')).toBe('"\'@evil"')
  })

  it('neutralise tab et CR en début de cellule', () => {
    expect(csvCell('\t=evil')).toBe('"\'\t=evil"')
    expect(csvCell('\r=evil')).toBe('"\'\r=evil"')
  })

  it("ne neutralise pas les = qui ne sont pas en début de cellule", () => {
    expect(csvCell('a=b')).toBe('"a=b"')
  })

  it('accepte un nombre et le wrappe entre guillemets', () => {
    expect(csvCell(42)).toBe('"42"')
  })

  it("formule injection : valeur '0' n'est pas traitée comme vide", () => {
    expect(csvCell(0)).toBe('"0"')
  })
})

describe('csvRow', () => {
  it('joint les cellules avec une virgule', () => {
    expect(csvRow(['a', 'b', 'c'])).toBe('"a","b","c"')
  })

  it('mélange null, nombres et textes', () => {
    expect(csvRow(['Alice', null, 12.5, 'note'])).toBe('"Alice",,"12.5","note"')
  })
})
