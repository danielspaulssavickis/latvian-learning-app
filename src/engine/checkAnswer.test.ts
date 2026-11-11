import { describe, expect, it } from 'vitest'
import { checkAnswer, diacriticDiff, matchAnswer, matchConfusable } from './checkAnswer'

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

describe('checkAnswer — whole sentences', () => {
  const sentence = { ignorePunctuation: true }

  it('ignores punctuation only when asked', () => {
    expect(checkAnswer('Es dzīvoju Rīgā.', 'es dzīvoju Rīgā', sentence)).toBe('correct')
    expect(checkAnswer('Es dzīvoju Rīgā.', 'es dzīvoju Rīgā')).toBe('wrong')
    expect(checkAnswer('Man nav laika.', 'Man nav laika!', sentence)).toBe('correct')
  })

  it('still grades diacritics and word forms', () => {
    expect(checkAnswer('Es dzīvoju Rīgā.', 'Es dzivoju Riga', sentence)).toBe('nearMiss')
    expect(checkAnswer('Es dzīvoju Rīgā.', 'Es dzīvoju Rīgu.', sentence)).toBe('wrong')
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

describe('checkAnswer — real forms of the same word (ADR-014)', () => {
  const confusables = [{ form: 'galda', label: 'genitive singular' }]

  it('marks another real form of the word wrong, not a near miss', () => {
    expect(checkAnswer('galdā', 'galda', { confusables })).toBe('wrong')
    expect(checkAnswer('galdā', 'GALDA', { confusables })).toBe('wrong')
    expect(matchConfusable('galda', { confusables })).toEqual(confusables[0])
  })

  it('keeps a spelling that is no real form a near miss', () => {
    const rigaForms = [{ form: 'Rīga', label: 'nominative singular' }]
    expect(checkAnswer('Rīgā', 'Riga', { confusables: rigaForms })).toBe('nearMiss')
    expect(checkAnswer('Rīgā', 'Rīga', { confusables: rigaForms })).toBe('wrong')
  })

  it('changes nothing for correct answers or without confusables', () => {
    expect(checkAnswer('galdā', 'galdā', { confusables })).toBe('correct')
    expect(checkAnswer('galdā', 'galda')).toBe('nearMiss')
  })
})

describe('checkAnswer — accepted alternatives (ADR-016)', () => {
  const options = { ignorePunctuation: true, alternatives: ['Šodien man jāstrādā.'] }

  it('accepts a listed alternative as correct and says which one matched', () => {
    expect(checkAnswer('Man šodien jāstrādā.', 'šodien man jāstrādā', options)).toBe('correct')
    expect(matchAnswer('Man šodien jāstrādā.', 'šodien man jāstrādā', options)).toEqual({
      result: 'correct',
      target: 'Šodien man jāstrādā.',
    })
  })

  it('grades a near miss of an alternative against that alternative', () => {
    expect(matchAnswer('Man šodien jāstrādā.', 'Sodien man jastrada', options)).toEqual({
      result: 'nearMiss',
      target: 'Šodien man jāstrādā.',
    })
    expect(diacriticDiff('Man šodien jāstrādā.', 'Sodien man jastrada', options)?.[0]).toEqual({
      text: 'Š',
      differs: true,
    })
  })

  it('prefers the main answer on a tie and still rejects anything else', () => {
    expect(matchAnswer('Man šodien jāstrādā.', 'man šodien jāstrādā', options).target).toBe(
      'Man šodien jāstrādā.',
    )
    expect(checkAnswer('Man šodien jāstrādā.', 'Man jāstrādā šodien', options)).toBe('wrong')
  })
})

describe('checkAnswer — English answers', () => {
  const english = { ignorePunctuation: true, language: 'en' as const }

  it('ignores case, punctuation and contractions', () => {
    expect(checkAnswer("I don't have time.", 'i do not have time', english)).toBe('correct')
    expect(checkAnswer('I am going to school.', "I'm going to school!", english)).toBe('correct')
    expect(checkAnswer('We are going to Riga.', 'We’re going to Riga', english)).toBe('correct')
    expect(checkAnswer('I cannot sleep.', "I can't sleep", english)).toBe('correct')
    expect(checkAnswer('That is the house number.', "that's the house number", english)).toBe(
      'correct',
    )
    expect(checkAnswer("I live at my brother's.", 'I live at my brothers', english)).toBe('wrong')
  })

  it('is otherwise exact', () => {
    expect(checkAnswer('I live in Riga.', 'I live in Latvia.', english)).toBe('wrong')
    expect(checkAnswer('I have two children.', 'I have two kids.', english)).toBe('wrong')
  })
})
