import { describe, expect, it } from 'vitest'
import type { Answer } from './reviewSession'
import { summarize } from './summary'

function answer(feature: string, result: Answer['result'], firstAttempt = true): Answer {
  return {
    cardId: `${feature}-${result}`,
    kind: 'cloze',
    feature,
    expected: 'x',
    given: 'x',
    result,
    responseMs: 1000,
    firstAttempt,
  }
}

describe('summarize', () => {
  it('counts first attempts only, and reports accuracy', () => {
    const summary = summarize([
      answer('case:loc', 'correct'),
      answer('case:loc', 'nearMiss'),
      answer('case:gen', 'wrong'),
      answer('case:gen', 'correct', false), // the repeat doesn't count
    ])
    expect(summary.count).toBe(3)
    expect(summary.correct).toBe(1)
    expect(summary.nearMiss).toBe(1)
    expect(summary.wrong).toBe(1)
    expect(summary.accuracy).toBeCloseTo(2 / 3)
  })

  it('lists features worst-first, by share of first attempts wrong', () => {
    const summary = summarize([
      answer('case:loc', 'correct'),
      answer('case:loc', 'wrong'),
      answer('case:gen', 'wrong'),
      answer('case:dat', 'correct'),
      answer('case:acc', 'nearMiss'),
    ])
    expect(summary.byFeature.map((f) => [f.feature, f.wrong, f.total])).toEqual([
      ['case:gen', 1, 1],
      ['case:loc', 1, 2],
      ['case:acc', 0, 1],
      ['case:dat', 0, 1],
    ])
  })

  it('handles an empty session', () => {
    expect(summarize([])).toEqual({
      count: 0,
      correct: 0,
      nearMiss: 0,
      wrong: 0,
      accuracy: 0,
      byFeature: [],
    })
  })
})
