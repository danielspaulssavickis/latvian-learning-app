import { describe, expect, it } from 'vitest'
import {
  buildApproveContext,
  buildApprovedGrammarFile,
  buildApprovedLexeme,
  buildApprovedSentence,
  buildApprovedSentences,
  checkContent,
} from './validate'

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

function goodGrammarTable(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'noun-endings' as const,
    id: 'noun_test_decl4',
    declension: 4 as const,
    gender: 'f' as const,
    lemmaEndings: ['vārds'],
    endings: { sg: { gen: 'vārda', loc: 'vārdā' }, pl: {} },
    review: 'draft' as const,
    ...overrides,
  }
}

describe('checkContent', () => {
  it('reports ok:true with no errors for a clean fixture set', () => {
    const result = checkContent({
      lexemes: [{ path: 'content/lexemes/test_noun.json', data: goodLexeme() }],
      sentences: [{ path: 'content/sentences/snt_0001.json', data: goodSentence() }],
      grammar: [{ path: 'content/grammar/decl4.json', data: goodGrammarTable() }],
    })
    expect(result).toEqual({ ok: true, errors: [], warnings: [] })
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

describe('checkContent — grammar files', () => {
  it('rejects two ending tables for the same declension and gender', () => {
    const result = checkContent({
      lexemes: [],
      sentences: [],
      grammar: [
        { path: 'content/grammar/a.json', data: goodGrammarTable() },
        { path: 'content/grammar/b.json', data: goodGrammarTable({ id: 'noun_other' }) },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual({
      file: 'content/grammar/b.json',
      message: expect.stringContaining('duplicate ending table'),
    })
  })

  it('rejects a grammar file with an unknown kind', () => {
    const result = checkContent({
      lexemes: [],
      sentences: [],
      grammar: [{ path: 'content/grammar/x.json', data: { kind: 'verb-endings', id: 'x' } }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors[0].file).toBe('content/grammar/x.json')
  })
})

describe('checkContent — round-trip annotation check', () => {
  function tree(features: Record<string, unknown>, surface: string) {
    const sentence = goodSentence()
    sentence.tokens[0] = { ...sentence.tokens[0], surface, features }
    return {
      lexemes: [{ path: 'content/lexemes/test_noun.json', data: goodLexeme() }],
      sentences: [{ path: 'content/sentences/snt_0001.json', data: sentence }],
      grammar: [{ path: 'content/grammar/decl4.json', data: goodGrammarTable() }],
    }
  }

  it('passes a token that round-trips', () => {
    const result = checkContent(tree({ case: 'loc', number: 'sg' }, 'Testvārdā'))
    expect(result).toEqual({ ok: true, errors: [], warnings: [] })
  })

  it('fails with the sentence file, id, token index, expected and actual on a mismatch', () => {
    const result = checkContent(tree({ case: 'loc', number: 'sg' }, 'Testvārda'))
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([
      {
        file: 'content/sentences/snt_0001.json',
        message: expect.stringMatching(/snt_0001 token 0 .*expected "Testvārda", got "testvārdā"/),
      },
    ])
  })

  it('warns, but does not fail, on a gap in the ending table', () => {
    const result = checkContent(tree({ case: 'dat', number: 'sg' }, 'Testvārdai'))
    expect(result.ok).toBe(true)
    expect(result.warnings).toEqual([
      { file: 'content/sentences/snt_0001.json', message: expect.stringContaining('dat.sg') },
    ])
  })

  it('does not run until every file is individually valid', () => {
    const broken = tree({ case: 'loc', number: 'sg' }, 'Testvārda')
    broken.lexemes.push({ path: 'content/lexemes/bad.json', data: { id: 'lex_bad' } as never })
    const result = checkContent(broken)
    expect(result.errors.every((e) => e.file === 'content/lexemes/bad.json')).toBe(true)
  })
})

describe('buildApprovedGrammarFile', () => {
  const now = new Date('2026-09-25T00:00:00.000Z')

  it('sets review and reviewedAt on a valid grammar file', () => {
    const result = buildApprovedGrammarFile(goodGrammarTable(), now)
    expect(result).toMatchObject({
      ok: true,
      file: { review: 'approved', reviewedAt: now.toISOString(), id: 'noun_test_decl4' },
    })
  })

  it('refuses an invalid grammar file', () => {
    const result = buildApprovedGrammarFile({ ...goodGrammarTable(), declension: 9 }, now)
    expect(result.ok).toBe(false)
  })
})

describe('buildApprovedSentence', () => {
  const now = new Date('2026-09-18T00:00:00.000Z')
  const lexemeIds = buildApproveContext({
    lexemes: [{ path: 'l.json', data: { ...goodLexeme(), review: 'approved' } }],
    grammar: [{ path: 'g.json', data: goodGrammarTable() }],
  })

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

describe('buildApprovedSentence — gates', () => {
  const now = new Date('2026-09-25T00:00:00.000Z')

  it('refuses a sentence whose lexeme is still a draft (ADR-010)', () => {
    const context = buildApproveContext({
      lexemes: [{ path: 'l.json', data: { ...goodLexeme(), review: 'draft' } }],
      grammar: [],
    })
    const result = buildApprovedSentence(goodSentence(), context, now)
    expect(result).toMatchObject({
      ok: false,
      errors: [{ message: expect.stringContaining('lex_test_noun is not approved') }],
    })
  })

  it('refuses a sentence that fails the round-trip check', () => {
    const context = buildApproveContext({
      lexemes: [{ path: 'l.json', data: { ...goodLexeme(), review: 'approved' } }],
      grammar: [{ path: 'g.json', data: goodGrammarTable() }],
    })
    const bad = goodSentence()
    bad.tokens[0] = {
      ...bad.tokens[0],
      surface: 'Testvārda',
      features: { case: 'loc', number: 'sg' },
    }
    const result = buildApprovedSentence(bad, context, now)
    expect(result).toMatchObject({
      ok: false,
      errors: [{ message: expect.stringContaining('expected "Testvārda"') }],
    })
  })
})

describe('buildApprovedLexeme', () => {
  it('approves a valid lexeme in place and refuses an invalid one', () => {
    const now = new Date('2026-09-25T00:00:00.000Z')
    expect(buildApprovedLexeme({ ...goodLexeme(), review: 'draft' }, now)).toMatchObject({
      ok: true,
      lexeme: { review: 'approved', reviewedAt: now.toISOString() },
    })
    expect(buildApprovedLexeme({ id: 'x' }, now).ok).toBe(false)
  })
})

describe('buildApprovedSentences (batch)', () => {
  const now = new Date('2026-09-18T00:00:00.000Z')
  const lexemeIds = buildApproveContext({
    lexemes: [{ path: 'l.json', data: { ...goodLexeme(), review: 'approved' } }],
    grammar: [{ path: 'g.json', data: goodGrammarTable() }],
  })

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
