import { describe, expect, it } from 'vitest'
import indexSource from './index.ts?raw'
import { content } from './index'

describe('content (real app adapter)', () => {
  it('loads without throwing when content/ has no authored files yet', () => {
    expect(content.lexemeById.size).toBe(0)
    expect(content.sentencesByLevel.size).toBe(0)
  })

  it('never globs content/drafts (ADR-006: drafts must not reach the loader)', () => {
    expect(indexSource).toContain("'../../content/sentences/*.json'")
    expect(indexSource).not.toContain("'../../content/drafts/")
  })
})
