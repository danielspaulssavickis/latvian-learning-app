import { describe, expect, it } from 'vitest'
import { FIXTURE_LEXEMES, SNT_1, SNT_10, SNT_3, SNT_5 } from './__fixtures__/sentences'
import { generateCards, primaryFeature } from './cards'

describe('generateCards', () => {
  it('makes one cloze card per drillable token, none for the rest', () => {
    const cards = generateCards([SNT_1, SNT_3], FIXTURE_LEXEMES)
    expect(cards.map((c) => c.id)).toEqual([
      'cloze:snt_0001#2',
      'cloze:snt_0003#0',
      'cloze:snt_0003#3',
    ])
  })

  it('fills in the SPEC.md card fields', () => {
    const [card] = generateCards([SNT_1], FIXTURE_LEXEMES)
    expect(card).toEqual({
      id: 'cloze:snt_0001#2',
      kind: 'cloze',
      targetId: 'snt_0001#2',
      sentenceId: 'snt_0001',
      tokenIndex: 2,
      feature: 'case:loc',
      features: ['case:loc', 'number:sg', 'declension:4'],
    })
  })

  it('adds the conjugation class for verbs', () => {
    const [card] = generateCards([SNT_5], FIXTURE_LEXEMES)
    expect(card.features).toEqual(['mood:debitive', 'tense:pres', 'conjugation:2'])
  })

  it('is deterministic and independent of input order', () => {
    const a = generateCards([SNT_10, SNT_1, SNT_3], FIXTURE_LEXEMES)
    const b = generateCards([SNT_3, SNT_10, SNT_1], FIXTURE_LEXEMES)
    expect(a).toEqual(b)
    expect(a.map((c) => c.sentenceId)).toEqual(['snt_0001', 'snt_0003', 'snt_0003', 'snt_0010'])
  })

  it("keeps existing cards' ids unchanged when a sentence is added", () => {
    const before = generateCards([SNT_1, SNT_10], FIXTURE_LEXEMES)
    const after = generateCards([SNT_1, SNT_3, SNT_10], FIXTURE_LEXEMES)
    for (const card of before) {
      expect(after).toContainEqual(card)
    }
    expect(after).toHaveLength(before.length + 2)
  })

  it('throws on a token whose lexeme is missing, rather than inventing one', () => {
    expect(() => generateCards([SNT_1], new Map())).toThrow(/lex_riga/)
  })
})

describe('primaryFeature', () => {
  it('picks mood over case over tense over person over number', () => {
    expect(primaryFeature({ mood: 'debitive', tense: 'pres' })).toBe('mood:debitive')
    expect(primaryFeature({ case: 'dat', number: 'sg' })).toBe('case:dat')
    expect(primaryFeature({ tense: 'past', person: 1, number: 'pl' })).toBe('tense:past')
    expect(primaryFeature({ person: 2, number: 'sg' })).toBe('person:2')
    expect(primaryFeature({ number: 'pl' })).toBe('number:pl')
  })
})
