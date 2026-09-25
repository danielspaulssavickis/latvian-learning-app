import { describe, expect, it } from 'vitest'
import { checkAnswer, diacriticDiff } from './checkAnswer'

describe('checkAnswer', () => {
  it('Rīgā vs Riga is a near miss (missing macrons only)', () => {
    expect(checkAnswer('Rīgā', 'Riga')).toBe('nearMiss')
  })

  it('Rīgā vs Rīgu is wrong (a different case, not a typo)', () => {
    expect(checkAnswer('Rīgā', 'Rīgu')).toBe('wrong')
  })

  it('an exact match is correct', () => {
    expect(checkAnswer('Rīgā', 'Rīgā')).toBe('correct')
  })

  it('ignores letter case', () => {
    expect(checkAnswer('Rīgā', 'rīgā')).toBe('correct')
    expect(checkAnswer('Rīgā', 'RĪGĀ')).toBe('correct')
  })

  it('trims and collapses internal whitespace', () => {
    expect(checkAnswer('Es dzīvoju Rīgā', '  Es   dzīvoju\tRīgā ')).toBe('correct')
  })

  it('treats a decomposed (NFD) answer as identical to the NFC one', () => {
    expect(checkAnswer('Rīgā', 'Rīgā'.normalize('NFD'))).toBe('correct')
    expect(checkAnswer('Rīgā'.normalize('NFD'), 'Rīgā')).toBe('correct')
  })

  it('a missing cedilla or caron is a near miss too', () => {
    expect(checkAnswer('kaķis', 'kakis')).toBe('nearMiss')
    expect(checkAnswer('šodien', 'sodien')).toBe('nearMiss')
    expect(checkAnswer('brāļa', 'brala')).toBe('nearMiss')
  })

  it('a spurious diacritic is a near miss (both sides are folded)', () => {
    expect(checkAnswer('Rīgu', 'Rīgū')).toBe('nearMiss')
  })

  it('a one-letter difference is wrong, never forgiven as a typo', () => {
    expect(checkAnswer('galdam', 'galdām')).toBe('nearMiss') // diacritic only
    expect(checkAnswer('galdam', 'galdan')).toBe('wrong')
    expect(checkAnswer('galdā', 'galda')).toBe('nearMiss')
    expect(checkAnswer('galdu', 'galdi')).toBe('wrong')
  })

  it('an empty answer is wrong', () => {
    expect(checkAnswer('Rīgā', '')).toBe('wrong')
    expect(checkAnswer('Rīgā', '   ')).toBe('wrong')
  })
})

describe('diacriticDiff', () => {
  it('marks each position whose diacritic differs, in the expected spelling', () => {
    expect(diacriticDiff('Rīgā', 'Riga')).toEqual([
      { text: 'R', differs: false },
      { text: 'ī', differs: true },
      { text: 'g', differs: false },
      { text: 'ā', differs: true },
    ])
  })

  it('works on decomposed and differently-cased input', () => {
    expect(diacriticDiff('Rīgā'.normalize('NFD'), 'RIGĀ')).toEqual([
      { text: 'R', differs: false },
      { text: 'ī', differs: true },
      { text: 'g', differs: false },
      { text: 'ā', differs: false },
    ])
  })

  it('returns null when the answer is not a near miss', () => {
    expect(diacriticDiff('Rīgā', 'Rīgu')).toBeNull()
    expect(diacriticDiff('Rīgā', 'Rīgā')).toBeNull()
  })
})
