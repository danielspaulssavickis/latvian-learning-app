import { describe, expect, it } from 'vitest'
import type { CheckResult } from './checkAnswer'
import { featureRetention, type ReviewFact } from './retention'

const T0 = new Date('2026-09-01T00:00:00.000Z').getTime()
let tick = 0
function fact(features: string[], result: CheckResult): ReviewFact {
  tick += 1
  return { features, result, reviewedAt: new Date(T0 + tick * 60_000) }
}

describe('featureRetention', () => {
  it('identifies a feature failed ten times in a row as the weakest (M4 done-when)', () => {
    const facts: ReviewFact[] = []
    for (let i = 0; i < 20; i++) facts.push(fact(['case:loc', 'number:sg'], 'correct'))
    for (let i = 0; i < 5; i++) facts.push(fact(['case:dat', 'number:sg'], 'correct'))
    for (let i = 0; i < 10; i++) facts.push(fact(['case:gen', 'number:sg'], 'wrong'))
    const [worst, ...rest] = featureRetention(facts)
    expect(worst).toMatchObject({
      feature: 'case:gen',
      count: 10,
      retained: 0,
      retention: 0,
      wrongStreak: 10,
    })
    expect(rest.map((r) => r.feature)).toContain('case:loc')
  })

  it('only looks at the trailing 30 reviews of each feature', () => {
    const facts: ReviewFact[] = []
    for (let i = 0; i < 10; i++) facts.push(fact(['case:acc'], 'wrong'))
    for (let i = 0; i < 30; i++) facts.push(fact(['case:acc'], 'correct'))
    const [acc] = featureRetention(facts)
    expect(acc).toMatchObject({ count: 30, retained: 30, retention: 1, wrongStreak: 0 })
  })

  it('counts a near miss as retained (it is graded hard, not a failure)', () => {
    const [f] = featureRetention([fact(['case:loc'], 'nearMiss'), fact(['case:loc'], 'wrong')])
    expect(f).toMatchObject({ count: 2, retained: 1, retention: 0.5, wrongStreak: 1 })
  })

  it('orders by retention, then by the current wrong streak, then by name', () => {
    const facts = [
      fact(['a'], 'correct'),
      fact(['a'], 'wrong'),
      fact(['b'], 'wrong'),
      fact(['b'], 'correct'),
      fact(['c'], 'correct'),
    ]
    expect(featureRetention(facts).map((r) => r.feature)).toEqual(['a', 'b', 'c'])
  })

  it('does not depend on input order', () => {
    const facts = [fact(['x'], 'wrong'), fact(['x'], 'correct')]
    expect(featureRetention([...facts].reverse())).toEqual(featureRetention(facts))
  })

  it('flags features with fewer than 5 reviews as low-data', () => {
    const [f] = featureRetention([fact(['case:ins'], 'correct')])
    expect(f.lowData).toBe(true)
  })

  it('accepts a custom window', () => {
    const facts = [fact(['x'], 'wrong'), fact(['x'], 'correct')]
    expect(featureRetention(facts, { window: 1 })[0]).toMatchObject({ count: 1, retention: 1 })
  })
})
