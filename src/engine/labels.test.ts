import { describe, expect, it } from 'vitest'
import { featureLabel, formatDueIn } from './labels'

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
    ['skill:produce', 'writing sentences (produce)'],
    ['gender:f', 'feminine'],
    ['skill:hear', 'understanding by ear (hear)'],
    ['definiteness:definite', 'definite'],
    ['something:else', 'something:else'],
  ])('%s → %s', (feature, label) => {
    expect(featureLabel(feature)).toBe(label)
  })
})

describe('formatDueIn', () => {
  const now = new Date(2026, 10, 5, 14, 0)
  const at = (h: number, m = 0, d = 5) => new Date(2026, 10, d, h, m)
  it.each([
    [at(14, 0, 5), 'in a minute'],
    [at(14, 8), 'in 8 minutes'],
    [at(16, 30), 'at 16:30'],
    [at(9, 5, 6), 'tomorrow at 09:05'],
    [at(9, 0, 12), 'on 12 Nov'],
  ])('%s → %s', (due, label) => {
    expect(formatDueIn(due, now)).toBe(label)
  })
})
