import { describe, expect, it } from 'vitest'
import { buildApprovedSentence, buildApprovedSentences, checkContent } from './validate'

function goodLexeme() {
  return {
    id: 'lex_test_noun',
    lemma: 'testvārds',
    pos: 'noun' as const,
    gender: 'f' as const,
    declension: 4 as const,
    conjugation: null,
    gloss: ['test word'],
    tags: [],
  }
}

interface RawToken {
  surface: string
  lexeme: string
  features: Record<string, unknown>
  drillable?: boolean
}

function goodSentence(overrides: { id?: string } = {}): {
  id: string
  text: string
  gloss: string
  level: 'a1' | 'a2' | 'b1'
  tokens: RawToken[]
} {
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
    ],
    ...overrides,
  }
}

function goodGrammarTable() {
  return {
    id: 'gram_test_decl4',
    pos: 'noun' as const,
    class: 4,
    endings: { sg: { nom: '-s', gen: '-a' } },
  }
}

describe('checkContent', () => {
  it('reports ok:true with no errors for a clean fixture set', () => {
    const result = checkContent({
      lexemes: [{ path: 'content/lexemes/test_noun.json', data: goodLexeme() }],
      sentences: [{ path: 'content/sentences/snt_0001.json', data: goodSentence() }],
      grammar: [{ path: 'content/grammar/decl4.json', data: goodGrammarTable() }],
    })
    expect(result).toEqual({ ok: true, errors: [] })
  })

  it('reports the file path and message for a sentence referencing an unknown lexeme', () => {
    const badSentence = goodSentence()
    badSentence.tokens[0] = { ...badSentence.tokens[0], lexeme: 'lex_does_not_exist' }
    const result = checkContent({
      lexemes: [{ path: 'content/lexemes/test_noun.json', data: goodLexeme() }],
      sentences: [{ path: 'content/sentences/snt_bad.json', data: badSentence }],
      grammar: [],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        file: 'content/sentences/snt_bad.json',
        message: expect.stringContaining('lex_does_not_exist'),
      }),
    )
  })

  it('reports the file path and message for a token with no features', () => {
    const badSentence = goodSentence()
    badSentence.tokens[0] = { ...badSentence.tokens[0], features: {} }
    const result = checkContent({
      lexemes: [{ path: 'content/lexemes/test_noun.json', data: goodLexeme() }],
      sentences: [{ path: 'content/sentences/snt_bad.json', data: badSentence }],
      grammar: [],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ file: 'content/sentences/snt_bad.json' }),
    )
  })

  it('reports the file path and message for a sentence with no drillable token', () => {
    const badSentence = goodSentence()
    badSentence.tokens[0] = { ...badSentence.tokens[0], drillable: undefined }
    const result = checkContent({
      lexemes: [{ path: 'content/lexemes/test_noun.json', data: goodLexeme() }],
      sentences: [{ path: 'content/sentences/snt_bad.json', data: badSentence }],
      grammar: [],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ file: 'content/sentences/snt_bad.json' }),
    )
  })

  it('reports an invalid lexeme file by path', () => {
    const result = checkContent({
      lexemes: [{ path: 'content/lexemes/bad.json', data: { id: 'lex_bad' } }],
      sentences: [],
      grammar: [],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ file: 'content/lexemes/bad.json' }),
    )
  })
})

describe('buildApprovedSentence', () => {
  const now = new Date('2026-09-18T00:00:00.000Z')
  const lexemeIds = new Set(['lex_test_noun'])

  it('sets review and reviewedAt on a valid draft', () => {
    const result = buildApprovedSentence(goodSentence(), lexemeIds, now)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.sentence.review).toBe('approved')
      expect(result.sentence.reviewedAt).toBe(now.toISOString())
    }
  })

  it('refuses an invalid draft and sets no fields', () => {
    const badSentence = goodSentence()
    badSentence.tokens[0] = { ...badSentence.tokens[0], drillable: undefined }
    const result = buildApprovedSentence(badSentence, lexemeIds, now)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })
})

describe('buildApprovedSentences (batch)', () => {
  const now = new Date('2026-09-18T00:00:00.000Z')
  const lexemeIds = new Set(['lex_test_noun'])

  it('approves the good sentences and reports the bad ones, without cross-contamination', () => {
    const bad = goodSentence({ id: 'snt_bad' })
    bad.tokens[0] = { ...bad.tokens[0], drillable: undefined }
    const good1 = goodSentence({ id: 'snt_good_1' })
    const good2 = goodSentence({ id: 'snt_good_2' })

    const results = buildApprovedSentences([good1, bad, good2], lexemeIds, now)

    expect(results).toHaveLength(3)
    expect(results[0]).toMatchObject({ id: 'snt_good_1', ok: true })
    expect(results[1]).toMatchObject({ id: 'snt_bad', ok: false })
    expect(results[2]).toMatchObject({ id: 'snt_good_2', ok: true })

    const good = results.filter((r) => r.ok)
    expect(good).toHaveLength(2)
    for (const result of good) {
      if (result.ok) {
        expect(result.sentence.review).toBe('approved')
        expect(result.sentence.reviewedAt).toBe(now.toISOString())
      }
    }

    const failed = results.find((r) => r.id === 'snt_bad')
    if (failed && !failed.ok) {
      expect(failed.errors.length).toBeGreaterThan(0)
      expect(failed.raw).toBe(bad)
    }
  })

  it('falls back to a positional id when a raw item has no string id', () => {
    const results = buildApprovedSentences([{ nonsense: true }], lexemeIds, now)
    expect(results[0].id).toBe('#0')
    expect(results[0].ok).toBe(false)
  })
})
