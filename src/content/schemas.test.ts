import { describe, expect, it } from 'vitest'
import { lexemeSchema, makeSentenceSchema, sentenceBaseSchema } from './schemas'

const validLexemeIds = new Set(['lex_test_noun', 'lex_test_verb'])

interface RawToken {
  surface: string
  lexeme: string
  features: Record<string, unknown>
  drillable?: boolean
}

interface RawSentence {
  id: string
  text: string
  gloss: string
  level: 'a1' | 'a2' | 'b1'
  tokens: RawToken[]
}

function validSentence(): RawSentence {
  return {
    id: 'snt_0001',
    text: 'Testvārds testā.',
    gloss: 'Test gloss.',
    level: 'a1',
    tokens: [
      {
        surface: 'Testvārds',
        lexeme: 'lex_test_noun',
        features: { case: 'nom', number: 'sg' },
        drillable: true,
      },
      {
        surface: 'testā',
        lexeme: 'lex_test_verb',
        features: { tense: 'pres', person: 1, number: 'sg' },
      },
    ],
  }
}

describe('lexemeSchema', () => {
  it('accepts a valid lexeme', () => {
    const result = lexemeSchema.safeParse({
      id: 'lex_test_noun',
      lemma: 'testvārds',
      pos: 'noun',
      gender: 'f',
      declension: 4,
      conjugation: null,
      gloss: ['test word'],
      tags: ['a1'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a lemma that is not NFC-normalized', () => {
    // "a" + combining macron (U+0304), decomposed rather than precomposed "ā"
    const decomposed = 'testvārds'
    const result = lexemeSchema.safeParse({
      id: 'lex_test_noun',
      lemma: decomposed,
      pos: 'noun',
      gender: 'f',
      declension: 4,
      conjugation: null,
      gloss: ['test word'],
      tags: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('sentenceBaseSchema', () => {
  it('accepts a valid sentence', () => {
    const result = sentenceBaseSchema.safeParse(validSentence())
    expect(result.success).toBe(true)
  })

  it('rejects a token with no features', () => {
    const sentence = validSentence()
    sentence.tokens[0] = { ...sentence.tokens[0], features: {} }
    const result = sentenceBaseSchema.safeParse(sentence)
    expect(result.success).toBe(false)
  })

  it('rejects a sentence with no drillable token', () => {
    const sentence = validSentence()
    sentence.tokens[0] = { ...sentence.tokens[0], drillable: undefined }
    const result = sentenceBaseSchema.safeParse(sentence)
    expect(result.success).toBe(false)
  })

  it('accepts a non-drillable token with no features (e.g. a preposition)', () => {
    const sentence = validSentence()
    sentence.tokens[1] = { ...sentence.tokens[1], features: {} }
    const result = sentenceBaseSchema.safeParse(sentence)
    expect(result.success).toBe(true)
  })

  it('accepts an optional source field', () => {
    const result = sentenceBaseSchema.safeParse({ ...validSentence(), source: 'generated' })
    expect(result.success).toBe(true)
  })

  it('rejects an unrecognized source value', () => {
    const result = sentenceBaseSchema.safeParse({ ...validSentence(), source: 'invented' })
    expect(result.success).toBe(false)
  })

  it('accepts a debitive mood feature', () => {
    const sentence = validSentence()
    sentence.tokens[1] = {
      ...sentence.tokens[1],
      features: { mood: 'debitive', person: 3, number: 'sg' },
    }
    const result = sentenceBaseSchema.safeParse(sentence)
    expect(result.success).toBe(true)
  })
})

describe('makeSentenceSchema', () => {
  it('accepts a sentence whose tokens all reference known lexeme ids', () => {
    const schema = makeSentenceSchema(validLexemeIds)
    const result = schema.safeParse(validSentence())
    expect(result.success).toBe(true)
  })

  it('rejects a sentence referencing a lexeme id that does not exist', () => {
    const schema = makeSentenceSchema(validLexemeIds)
    const sentence = validSentence()
    sentence.tokens[1] = { ...sentence.tokens[1], lexeme: 'lex_does_not_exist' }
    const result = schema.safeParse(sentence)
    expect(result.success).toBe(false)
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(' ')
      expect(message).toContain('lex_does_not_exist')
    }
  })
})
