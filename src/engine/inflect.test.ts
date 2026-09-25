import { describe, expect, it } from 'vitest'
import type { AlternationsFile, Lexeme, NounEndingTable } from '../content/schemas'
import { buildGrammar, inflect } from './inflect'

// Synthetic tables with made-up endings: these tests pin the engine's
// mechanics, independent of whether the real Latvian tables are right
// (that's src/engine/paradigms.test.ts's job).

function table(overrides: Partial<NounEndingTable> = {}): NounEndingTable {
  return {
    kind: 'noun-endings',
    id: 'noun_test',
    declension: 1,
    gender: null,
    lemmaEndings: ['xs'],
    endings: {
      sg: { nom: 'xs', gen: 'GEN', dat: 'DAT' },
      pl: { nom: 'PL', gen: 'GENPL' },
    },
    review: 'approved',
    ...overrides,
  }
}

function alternations(overrides: Partial<AlternationsFile> = {}): AlternationsFile {
  return {
    kind: 'alternations',
    id: 'alternations',
    appliesTo: [{ declension: 1, forms: ['gen.sg', 'gen.pl'] }],
    rules: [
      { from: 'l', to: 'ļ' },
      { from: 'ln', to: 'ļņ' },
      { from: 'st', to: 'st' },
      { from: 't', to: 'š' },
    ],
    review: 'approved',
    ...overrides,
  }
}

function lexeme(overrides: Partial<Lexeme> = {}): Lexeme {
  return {
    id: 'lex_test',
    lemma: 'bolxs',
    pos: 'noun',
    gender: 'm',
    declension: 1,
    conjugation: null,
    gloss: ['test'],
    tags: [],
    ...overrides,
  }
}

describe('inflect — table lookup', () => {
  const grammar = buildGrammar([table()])

  it('strips the lemma ending and appends the table ending', () => {
    expect(inflect(lexeme(), { case: 'dat', number: 'sg' }, grammar)).toEqual({
      ok: true,
      form: 'bolDAT',
      confidence: 'verified',
      source: 'table',
    })
  })

  it('returns the lemma itself for nom.sg', () => {
    expect(inflect(lexeme(), { case: 'nom', number: 'sg' }, grammar)).toMatchObject({
      ok: true,
      form: 'bolxs',
      source: 'lemma',
    })
  })

  it('reports a gap, not a guess, for a missing table cell', () => {
    expect(inflect(lexeme(), { case: 'loc', number: 'sg' }, grammar)).toMatchObject({
      ok: false,
      reason: 'gap',
    })
  })

  it('uses the longest matching lemma ending', () => {
    const g = buildGrammar([table({ lemmaEndings: ['s', 'xs'] })])
    expect(inflect(lexeme(), { case: 'dat', number: 'sg' }, g)).toMatchObject({ form: 'bolDAT' })
  })

  it('refuses a lemma that does not end in any of the table lemma endings', () => {
    expect(
      inflect(lexeme({ lemma: 'boly' }), { case: 'dat', number: 'sg' }, grammar),
    ).toMatchObject({ ok: false, reason: 'lemma-mismatch' })
  })

  it('prefers a gender-specific table over a gender-neutral one', () => {
    const g = buildGrammar([
      table(),
      table({ id: 'noun_test_f', gender: 'f', endings: { sg: { dat: 'FEM' }, pl: {} } }),
    ])
    expect(inflect(lexeme({ gender: 'f' }), { case: 'dat', number: 'sg' }, g)).toMatchObject({
      form: 'bolFEM',
    })
    expect(inflect(lexeme({ gender: 'm' }), { case: 'dat', number: 'sg' }, g)).toMatchObject({
      form: 'bolDAT',
    })
  })

  it('reports no-table when no table covers the declension and gender', () => {
    const g = buildGrammar([table({ gender: 'f' })])
    expect(inflect(lexeme({ gender: 'm' }), { case: 'dat', number: 'sg' }, g)).toMatchObject({
      ok: false,
      reason: 'no-table',
    })
  })
})

describe('inflect — irregular overrides', () => {
  it('takes precedence over the table', () => {
    const g = buildGrammar([table()])
    const lex = lexeme({ irregular: { 'dat.sg': 'bolOVERRIDE' } })
    expect(inflect(lex, { case: 'dat', number: 'sg' }, g)).toEqual({
      ok: true,
      form: 'bolOVERRIDE',
      confidence: 'verified',
      source: 'irregular',
    })
  })

  it('fills a table gap', () => {
    const g = buildGrammar([table()])
    const lex = lexeme({ irregular: { 'loc.sg': 'bolLOC' } })
    expect(inflect(lex, { case: 'loc', number: 'sg' }, g)).toMatchObject({ form: 'bolLOC' })
  })

  it('works with no table at all', () => {
    const lex = lexeme({ declension: null, irregular: { 'gen.sg': 'bolGEN' } })
    expect(inflect(lex, { case: 'gen', number: 'sg' }, buildGrammar([]))).toMatchObject({
      form: 'bolGEN',
    })
  })
})

describe('inflect — consonant alternation', () => {
  it('applies the rule only in the slots listed for the declension', () => {
    const g = buildGrammar([table(), alternations()])
    expect(inflect(lexeme(), { case: 'gen', number: 'sg' }, g)).toMatchObject({ form: 'boļGEN' })
    expect(inflect(lexeme(), { case: 'dat', number: 'sg' }, g)).toMatchObject({ form: 'bolDAT' })
    expect(inflect(lexeme(), { case: 'gen', number: 'pl' }, g)).toMatchObject({
      form: 'boļGENPL',
    })
  })

  it('does not alternate in a declension that has no slots listed', () => {
    const g = buildGrammar([
      table({ declension: 4 }),
      alternations({ appliesTo: [{ declension: 1, forms: ['gen.sg'] }] }),
    ])
    expect(inflect(lexeme({ declension: 4 }), { case: 'gen', number: 'sg' }, g)).toMatchObject({
      form: 'bolGEN',
    })
  })

  it('matches the longest rule first (ln → ļņ, not n alone)', () => {
    const g = buildGrammar([table(), alternations()])
    expect(inflect(lexeme({ lemma: 'vilnxs' }), { case: 'gen', number: 'sg' }, g)).toMatchObject({
      form: 'viļņGEN',
    })
  })

  it('lets an identity rule block a shorter one (st stays st, not sš)', () => {
    const g = buildGrammar([table(), alternations()])
    expect(inflect(lexeme({ lemma: 'valstxs' }), { case: 'gen', number: 'sg' }, g)).toMatchObject({
      form: 'valstGEN',
    })
    expect(inflect(lexeme({ lemma: 'naktxs' }), { case: 'gen', number: 'sg' }, g)).toMatchObject({
      form: 'nakšGEN',
    })
  })

  it('leaves the stem unchanged when no rule matches', () => {
    const g = buildGrammar([table(), alternations()])
    expect(inflect(lexeme({ lemma: 'kakxs' }), { case: 'gen', number: 'sg' }, g)).toMatchObject({
      form: 'kakGEN',
    })
  })

  it('is not applied on top of an irregular override', () => {
    const g = buildGrammar([table(), alternations()])
    const lex = lexeme({ irregular: { 'gen.sg': 'bolxs' } })
    expect(inflect(lex, { case: 'gen', number: 'sg' }, g)).toMatchObject({ form: 'bolxs' })
  })
})

describe('inflect — confidence follows the review gate (ADR-008)', () => {
  it('is unverified when the ending table is still a draft', () => {
    const g = buildGrammar([table({ review: 'draft' })])
    expect(inflect(lexeme(), { case: 'dat', number: 'sg' }, g)).toMatchObject({
      confidence: 'unverified',
    })
  })

  it('is unverified when the table has no review field at all', () => {
    const { review: _review, ...unreviewed } = table()
    void _review
    const g = buildGrammar([unreviewed])
    expect(inflect(lexeme(), { case: 'dat', number: 'sg' }, g)).toMatchObject({
      confidence: 'unverified',
    })
  })

  it('is unverified when an alternation rule from a draft rule file was applied', () => {
    const g = buildGrammar([table(), alternations({ review: 'draft' })])
    expect(inflect(lexeme(), { case: 'gen', number: 'sg' }, g)).toMatchObject({
      confidence: 'unverified',
    })
    // ...but a form the draft rule file didn't touch keeps the table's confidence.
    expect(inflect(lexeme(), { case: 'dat', number: 'sg' }, g)).toMatchObject({
      confidence: 'verified',
    })
  })
})

describe('inflect — unsupported input', () => {
  const grammar = buildGrammar([table()])

  it('refuses non-nouns (M2 is nouns only)', () => {
    expect(
      inflect(lexeme({ pos: 'verb', declension: null }), { tense: 'pres' }, grammar),
    ).toMatchObject({ ok: false, reason: 'unsupported-pos' })
  })

  it('refuses a feature set without both case and number', () => {
    expect(inflect(lexeme(), { case: 'gen' }, grammar)).toMatchObject({
      ok: false,
      reason: 'missing-features',
    })
  })

  it('refuses a noun with no declension class and no override', () => {
    expect(
      inflect(lexeme({ declension: null }), { case: 'gen', number: 'sg' }, grammar),
    ).toMatchObject({ ok: false, reason: 'no-declension' })
  })
})
