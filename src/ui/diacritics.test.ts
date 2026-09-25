import { describe, expect, it } from 'vitest'
import { insertAt, LATVIAN_LETTERS } from './diacritics'

describe('insertAt', () => {
  it('inserts at the caret', () => {
    expect(insertAt('Rga', 1, 1, 'ī')).toEqual({ value: 'Rīga', caret: 2 })
  })

  it('replaces a selection', () => {
    expect(insertAt('Riga', 1, 2, 'ī')).toEqual({ value: 'Rīga', caret: 2 })
  })

  it('appends at the end', () => {
    expect(insertAt('Rīg', 3, 3, 'ā')).toEqual({ value: 'Rīgā', caret: 4 })
  })
})

describe('LATVIAN_LETTERS', () => {
  it('are all NFC single code points', () => {
    for (const letter of LATVIAN_LETTERS) {
      expect(letter.normalize('NFC')).toBe(letter)
      expect([...letter]).toHaveLength(1)
    }
  })
})
