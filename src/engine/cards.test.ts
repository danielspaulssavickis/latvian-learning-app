import { describe, expect, it } from 'vitest'
import { FIXTURE_LEXEMES, SNT_1, SNT_10, SNT_3, SNT_5 } from './__fixtures__/sentences'
import { generateAllCards, generateCards, primaryFeature } from './cards'
import { buildGrammar } from './inflect'

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

describe('generateAllCards', () => {
  const lexemes = new Map(FIXTURE_LEXEMES)
  // A pronoun with its paradigm, so `Man` can produce an inflect card.
  lexemes.set('lex_es', {
    ...FIXTURE_LEXEMES.get('lex_es')!,
    irregular: { 'nom.sg': 'es', 'dat.sg': 'man' },
  })
  const grammar = buildGrammar([])

  it('adds recognize + produce per sentence and inflect where the form round-trips', () => {
    const cards = generateAllCards([SNT_1, SNT_3], lexemes, grammar)
    expect(cards.map((c) => c.id)).toEqual([
      'recognize:snt_0001',
      'cloze:snt_0001#2',
      'produce:snt_0001',
      'recognize:snt_0003',
      'cloze:snt_0003#0',
      'cloze:snt_0003#3',
      'inflect:lex_es@dat.sg',
      'produce:snt_0003',
    ])
  })

  it('shapes inflect and sentence-level cards', () => {
    const cards = generateAllCards([SNT_3], lexemes, grammar)
    expect(cards.find((c) => c.kind === 'inflect')).toEqual({
      id: 'inflect:lex_es@dat.sg',
      kind: 'inflect',
      targetId: 'lex_es@dat.sg',
      sentenceId: 'snt_0003',
      tokenIndex: 0,
      feature: 'case:dat',
      features: ['case:dat', 'number:sg'],
    })
    expect(cards.find((c) => c.kind === 'produce')).toMatchObject({
      tokenIndex: null,
      feature: 'skill:produce',
      features: ['skill:produce'],
    })
  })

  it('makes one inflect card per form even if several sentences use it', () => {
    const again = { ...SNT_3, id: 'snt_0099' }
    const ids = generateAllCards([SNT_3, again], lexemes, grammar).map((c) => c.id)
    expect(ids.filter((id) => id === 'inflect:lex_es@dat.sg')).toHaveLength(1)
  })

  it('skips an inflect card whose generated form does not match the sentence', () => {
    const wrongTable = new Map(lexemes)
    wrongTable.set('lex_es', { ...lexemes.get('lex_es')!, irregular: { 'dat.sg': 'mani' } })
    const ids = generateAllCards([SNT_3], wrongTable, grammar).map((c) => c.id)
    expect(ids.some((id) => id.startsWith('inflect:'))).toBe(false)
  })
})
