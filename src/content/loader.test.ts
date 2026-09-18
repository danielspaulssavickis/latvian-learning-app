import { describe, expect, it } from 'vitest'
import { loadContent } from './loader'

function goodLexeme(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'lex_test_noun',
    lemma: 'testvārds',
    pos: 'noun' as const,
    gender: 'f' as const,
    declension: 4 as const,
    conjugation: null,
    gloss: ['test word'],
    tags: [],
    ...overrides,
  }
}

function goodSentence(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'snt_0001',
    text: 'Testvārds testā.',
    gloss: 'Test gloss.',
    level: 'a1' as const,
    tokens: [
      {
        surface: 'Testvārds',
        lexeme: 'lex_test_noun',
        features: { case: 'loc', number: 'sg' },
        drillable: true,
      },
    ],
    ...overrides,
  }
}

describe('loadContent', () => {
  it('indexes lexemes by id', () => {
    const content = loadContent({
      lexemes: { 'content/lexemes/test_noun.json': goodLexeme() },
      sentences: {},
      grammar: {},
    })
    expect(content.lexemeById.get('lex_test_noun')?.lemma).toBe('testvārds')
  })

  it('indexes sentences by level', () => {
    const content = loadContent({
      lexemes: { 'content/lexemes/test_noun.json': goodLexeme() },
      sentences: { 'content/sentences/snt_0001.json': goodSentence() },
      grammar: {},
    })
    expect(content.sentencesByLevel.get('a1')?.map((s) => s.id)).toEqual(['snt_0001'])
  })

  it('indexes sentences by drillable feature', () => {
    const content = loadContent({
      lexemes: { 'content/lexemes/test_noun.json': goodLexeme() },
      sentences: { 'content/sentences/snt_0001.json': goodSentence() },
      grammar: {},
    })
    expect(content.sentencesByFeature.get('case:loc')?.map((s) => s.id)).toEqual(['snt_0001'])
    expect(content.sentencesByFeature.get('number:sg')?.map((s) => s.id)).toEqual(['snt_0001'])
  })

  it('does not index a non-drillable token feature', () => {
    const content = loadContent({
      lexemes: { 'content/lexemes/test_noun.json': goodLexeme() },
      sentences: {
        'content/sentences/snt_0001.json': goodSentence({
          tokens: [
            {
              surface: 'Testvārds',
              lexeme: 'lex_test_noun',
              features: { case: 'nom', number: 'sg' },
            },
            {
              surface: 'testā',
              lexeme: 'lex_test_noun',
              features: { case: 'loc', number: 'sg' },
              drillable: true,
            },
          ],
        }),
      },
      grammar: {},
    })
    // "nom" is on a non-drillable token and must not appear in the index.
    expect(content.sentencesByFeature.has('case:nom')).toBe(false)
    expect(content.sentencesByFeature.get('case:loc')?.map((s) => s.id)).toEqual(['snt_0001'])
  })

  it('throws one aggregated, descriptive error when content is invalid', () => {
    expect(() =>
      loadContent({
        lexemes: { 'content/lexemes/test_noun.json': goodLexeme() },
        sentences: {
          'content/sentences/snt_bad.json': goodSentence({
            tokens: [
              {
                surface: 'x',
                lexeme: 'lex_does_not_exist',
                features: { case: 'loc' },
                drillable: true,
              },
            ],
          }),
        },
        grammar: {},
      }),
    ).toThrow(/lex_does_not_exist/)
  })
})
