import { describe, expect, it } from 'vitest'
import indexSource from './index.ts?raw'
import { content } from './index'

describe('content (real app adapter)', () => {
  it('loads the published content without throwing', () => {
    expect(content.lexemeById.size).toBeGreaterThan(0)
  })

  it('only ever loads approved sentences (ADR-006)', () => {
    for (const sentences of content.sentencesByLevel.values()) {
      for (const sentence of sentences) expect(sentence.review).toBe('approved')
    }
  })

  it('loads the ending table for every declension class, plus the alternation rules', () => {
    const declensions = content.grammar.nounTables.map((t) => t.declension).sort()
    expect(declensions).toEqual([1, 2, 3, 4, 5, 6])
    expect(content.grammar.alternations).not.toBeNull()
  })

  it('never globs content/drafts (ADR-006: drafts must not reach the loader)', () => {
    expect(indexSource).toContain("'../../content/sentences/*.json'")
    expect(indexSource).not.toContain("'../../content/drafts/")
  })
})
