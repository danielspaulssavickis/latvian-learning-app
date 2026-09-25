import { describe, expect, it } from 'vitest'
import { buildGrammar } from '../engine/inflect'
import { checkRoundTrip } from './roundTrip'
import type { Lexeme, NounEndingTable, Sentence } from './schemas'

// Synthetic grammar and lexemes: this pins the check's reporting, not Latvian.
function table(review: 'draft' | 'approved'): NounEndingTable {
  return {
    kind: 'noun-endings',
    id: 'noun_test',
    declension: 4,
    gender: 'f',
    lemmaEndings: ['a'],
    endings: { sg: { gen: 'as', loc: 'ā' }, pl: {} },
    review,
  }
}

const noun: Lexeme = {
  id: 'lex_test',
  lemma: 'Testa',
  pos: 'noun',
  gender: 'f',
  declension: 4,
  conjugation: null,
  gloss: ['test'],
  tags: [],
}

const verb: Lexeme = { ...noun, id: 'lex_verb', lemma: 'testēt', pos: 'verb', declension: null }

const lexemeById = new Map([
  [noun.id, noun],
  [verb.id, verb],
])

function sentence(tokens: Sentence['tokens']): Sentence {
  return { id: 'snt_test', text: 'x', gloss: 'x', level: 'a1', tokens }
}

describe('checkRoundTrip', () => {
  const grammar = buildGrammar([table('approved')])

  it('passes a token whose surface is reproducible from lexeme + features', () => {
    const s = sentence([
      {
        surface: 'Testā',
        lexeme: 'lex_test',
        features: { case: 'loc', number: 'sg' },
        drillable: true,
      },
    ])
    expect(checkRoundTrip([s], lexemeById, grammar)).toEqual([])
  })

  it('ignores capitalization (sentence-initial words)', () => {
    const s = sentence([
      {
        surface: 'TESTĀ',
        lexeme: 'lex_test',
        features: { case: 'loc', number: 'sg' },
        drillable: true,
      },
    ])
    expect(checkRoundTrip([s], lexemeById, grammar)).toEqual([])
  })

  it('reports a mismatch with sentence id, token index, expected and actual', () => {
    const s = sentence([
      { surface: 'x', lexeme: 'lex_verb', features: {} },
      {
        surface: 'Testas',
        lexeme: 'lex_test',
        features: { case: 'loc', number: 'sg' },
        drillable: true,
      },
    ])
    const [finding] = checkRoundTrip([s], lexemeById, grammar)
    expect(finding).toMatchObject({
      kind: 'mismatch',
      sentenceId: 'snt_test',
      tokenIndex: 1,
      expected: 'Testas',
      actual: 'Testā',
    })
    expect(finding.message).toMatch(/snt_test token 1/)
    expect(finding.message).toMatch(/expected "Testas", got "Testā"/)
    expect(finding.message).toMatch(/tagging/)
  })

  it('says a mismatch from unverified table data may be a table error', () => {
    const s = sentence([
      {
        surface: 'Testas',
        lexeme: 'lex_test',
        features: { case: 'loc', number: 'sg' },
        drillable: true,
      },
    ])
    const [finding] = checkRoundTrip([s], lexemeById, buildGrammar([table('draft')]))
    expect(finding.kind).toBe('mismatch')
    expect(finding.message).toMatch(/unverified/)
  })

  it('reports a table gap separately from a mismatch', () => {
    const s = sentence([
      {
        surface: 'Testai',
        lexeme: 'lex_test',
        features: { case: 'dat', number: 'sg' },
        drillable: true,
      },
    ])
    const [finding] = checkRoundTrip([s], lexemeById, grammar)
    expect(finding).toMatchObject({ kind: 'gap', sentenceId: 'snt_test', tokenIndex: 0 })
    expect(finding.message).toMatch(/dat\.sg/)
  })

  it('reports a noun token tagged with case but no number as a tagging mismatch', () => {
    const s = sentence([
      { surface: 'Testā', lexeme: 'lex_test', features: { case: 'loc' }, drillable: true },
    ])
    const [finding] = checkRoundTrip([s], lexemeById, grammar)
    expect(finding).toMatchObject({ kind: 'mismatch', tokenIndex: 0 })
    expect(finding.message).toMatch(/case and number/)
  })

  it('skips tokens the engine cannot inflect yet (non-nouns) and feature-less tokens', () => {
    const s = sentence([
      {
        surface: 'testēju',
        lexeme: 'lex_verb',
        features: { tense: 'pres', person: 1, number: 'sg' },
      },
      { surface: 'Testa', lexeme: 'lex_test', features: {} },
      {
        surface: 'Testā',
        lexeme: 'lex_test',
        features: { case: 'loc', number: 'sg' },
        drillable: true,
      },
    ])
    expect(checkRoundTrip([s], lexemeById, grammar)).toEqual([])
  })
})
