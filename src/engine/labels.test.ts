import { describe, expect, it } from 'vitest'
import { featureLabel } from './labels'

describe('featureLabel', () => {
  it.each([
    ['case:loc', 'locative'],
    ['case:ins', 'instrumental'],
    ['number:pl', 'plural'],
    ['tense:pres', 'present tense'],
    ['person:1', '1st person'],
    ['mood:debitive', 'debitive (must / have to)'],
    ['declension:4', '4th declension'],
    ['conjugation:2', '2nd conjugation'],
    ['something:else', 'something:else'],
  ])('%s → %s', (feature, label) => {
    expect(featureLabel(feature)).toBe(label)
  })
})
