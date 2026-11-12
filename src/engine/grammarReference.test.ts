import { describe, expect, it } from 'vitest'
import type { Lexeme, NounEndingTable, Sentence } from '../content/schemas'
import {
  alternatedForms,
  declensionReference,
  hasNumber,
  draftPronounCount,
  paradigmOf,
  prepositionReference,
  pronounGroups,
  visibleParadigm,
} from './grammarReference'
import { buildGrammar } from './inflect'

// Placeholder data (CLAUDE.md rule 1): shapes only, not reviewed Latvian.
function lexeme(partial: Partial<Lexeme> & Pick<Lexeme, 'id' | 'lemma' | 'pos'>): Lexeme {
  return {
    gender: null,
    declension: null,
    conjugation: null,
    gloss: ['(fixture)'],
    tags: [],
    review: 'approved',
    ...partial,
  }
}

const decl1: NounEndingTable = {
  kind: 'noun-endings',
  id: 'noun_decl1',
  declension: 1,
  gender: 'm',
  lemmaEndings: ['s'],
  endings: {
    sg: { nom: 's', gen: 'a', dat: 'am', acc: 'u', ins: 'u', loc: 'ā' },
    pl: { nom: 'i', gen: 'u', dat: 'iem', acc: 'us', ins: 'iem', loc: 'os', voc: 'i' },
  },
  review: 'approved',
}
const grammar = buildGrammar([decl1])

const galds = lexeme({ id: 'lex_galds', lemma: 'galds', pos: 'noun', gender: 'm', declension: 1 })
const draugs = lexeme({
  id: 'lex_draugs',
  lemma: 'draugs',
  pos: 'noun',
  gender: 'm',
  declension: 1,
  review: 'draft',
})
const riga = lexeme({ id: 'lex_riga', lemma: 'Rīgs', pos: 'noun', gender: 'm', declension: 1 })
const unused = lexeme({ id: 'lex_kalns', lemma: 'kalns', pos: 'noun', gender: 'm', declension: 1 })
const zem = lexeme({ id: 'lex_zem', lemma: 'zem', pos: 'preposition' })
const ar = lexeme({ id: 'lex_ar', lemma: 'ar', pos: 'preposition' })
const lexemes = new Map([galds, draugs, riga, unused, zem, ar].map((l) => [l.id, l]))

function sentence(id: string, tokens: Sentence['tokens']): Sentence {
  return {
    id,
    text: tokens.map((t) => t.surface).join(' '),
    gloss: '(fixture)',
    level: 'a1',
    tokens,
  }
}

const sentences = [
  sentence('snt_0002', [
    { surface: 'zem', lexeme: 'lex_zem', features: {} },
    { surface: 'galda', lexeme: 'lex_galds', features: { case: 'gen', number: 'sg' } },
  ]),
  sentence('snt_0001', [
    { surface: 'ar', lexeme: 'lex_ar', features: {} },
    { surface: 'draugu', lexeme: 'lex_draugs', features: { case: 'ins', number: 'sg' } },
    { surface: 'Rīgā', lexeme: 'lex_riga', features: { case: 'loc', number: 'sg' } },
  ]),
  sentence('snt_0003', [
    { surface: 'ar', lexeme: 'lex_ar', features: {} },
    { surface: 'draugiem', lexeme: 'lex_draugs', features: { case: 'dat', number: 'pl' } },
  ]),
  sentence('snt_0004', [
    { surface: 'ar', lexeme: 'lex_ar', features: {} },
    { surface: 'galdu', lexeme: 'lex_galds', features: { case: 'ins', number: 'sg' } },
  ]),
]

describe('paradigmOf', () => {
  it('fills every case and number from inflect(), with gaps as null', () => {
    const paradigm = paradigmOf(galds, grammar)
    expect(paradigm['loc.sg']).toEqual({ form: 'galdā', confidence: 'verified' })
    expect(paradigm['dat.pl']).toEqual({ form: 'galdiem', confidence: 'verified' })
    expect(paradigm['voc.sg']).toBeNull()
  })

  it('hides unverified forms unless asked to show them', () => {
    const paradigm = paradigmOf(draugs, grammar)
    expect(visibleParadigm(paradigm, false)['gen.sg']).toBeNull()
    expect(visibleParadigm(paradigm, true)['gen.sg']).toEqual({
      form: 'drauga',
      confidence: 'unverified',
    })
  })
})

describe('pronoun paradigms and alternation', () => {
  it("uses only a pronoun's listed forms, so a plural-only pronoun has no singular", () => {
    const mes = lexeme({
      id: 'p_mes',
      lemma: 'mēs',
      pos: 'pronoun',
      irregular: { 'nom.pl': 'mēs', 'dat.pl': 'mums' },
    })
    const paradigm = paradigmOf(mes, grammar)
    expect(paradigm['nom.sg']).toBeNull()
    expect(paradigm['dat.pl']?.form).toBe('mums')
    expect([hasNumber(paradigm, 'sg'), hasNumber(paradigm, 'pl')]).toEqual([false, true])
  })

  it('marks the forms whose stem consonant alternates', () => {
    const withAlternation = buildGrammar([
      { ...decl1, id: 'noun_decl2', declension: 2, lemmaEndings: ['is'] },
      {
        kind: 'alternations',
        id: 'alternations',
        appliesTo: [{ declension: 2, forms: ['gen.sg', 'gen.pl'] }],
        rules: [
          { from: 'l', to: 'ļ' },
          { from: 'st', to: 'st' },
        ],
        review: 'approved',
      },
    ])
    const noun = (lemma: string) =>
      lexeme({ id: lemma, lemma, pos: 'noun', gender: 'm', declension: 2 })
    expect([...alternatedForms(noun('brālis'), withAlternation)]).toEqual(['gen.sg', 'gen.pl'])
    // An identity rule (st → st) blocks the change; a stem no rule matches has none either.
    expect(alternatedForms(noun('kastis'), withAlternation).size).toBe(0)
    expect(alternatedForms(noun('kakis'), withAlternation).size).toBe(0)
  })
})

describe('declensionReference', () => {
  it('picks common nouns the sentences use, most verified forms first', () => {
    const [entry] = declensionReference(sentences, lexemes, grammar)
    expect(entry.table.id).toBe('noun_decl1')
    // galds is fully verified, draugs is a draft; Rīgs is a name; kalns is unused.
    expect(entry.examples.map((e) => e.lexeme.lemma)).toEqual(['galds', 'draugs'])
  })
})

describe('prepositionReference', () => {
  it('reads the case after each preposition, one example per case and number', () => {
    const reference = prepositionReference(sentences, lexemes)
    expect(reference.map((r) => r.preposition.lemma)).toEqual(['ar', 'zem'])
    const [arUses, zemUses] = reference.map((r) =>
      r.uses.map((u) => `${u.case}.${u.number} ${u.sentence.id}#${u.tokenIndex}`),
    )
    expect(arUses).toEqual(['ins.sg snt_0001#1', 'dat.pl snt_0003#1'])
    expect(zemUses).toEqual(['gen.sg snt_0002#1'])
  })
})

describe('pronounGroups', () => {
  const pronouns = new Map(
    [
      lexeme({ id: 'p_es', lemma: 'es', pos: 'pronoun', tags: ['pronoun:personal', 'order:1'] }),
      lexeme({
        id: 'p_tu',
        lemma: 'tu',
        pos: 'pronoun',
        tags: ['pronoun:personal', 'order:2'],
        review: 'draft',
      }),
      lexeme({ id: 'p_mes', lemma: 'mēs', pos: 'pronoun', tags: ['pronoun:personal', 'order:5'] }),
      lexeme({
        id: 'p_kads',
        lemma: 'kāds',
        pos: 'pronoun',
        tags: ['pronoun:interrogative', 'pronoun:indefinite'],
      }),
      lexeme({ id: 'p_x', lemma: 'x', pos: 'pronoun' }),
    ].map((l) => [l.id, l]),
  )

  it('groups approved pronouns by tag, in tag order, a word in several groups if tagged so', () => {
    const groups = pronounGroups(pronouns, false)
    expect(groups.map((g) => [g.id, g.pronouns.map((p) => p.lemma)])).toEqual([
      ['personal', ['es', 'mēs']],
      ['interrogative', ['kāds']],
      ['indefinite', ['kāds']],
    ])
  })

  it('includes drafts only when asked, and counts them', () => {
    expect(pronounGroups(pronouns, true)[0].pronouns.map((p) => p.lemma)).toEqual([
      'es',
      'tu',
      'mēs',
    ])
    expect(draftPronounCount(pronouns)).toBe(1)
  })
})
