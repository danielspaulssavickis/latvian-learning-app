import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScheduler, gradeFor, isNew } from './schedule'

const T0 = new Date('2026-09-25T09:00:00.000Z')
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** A clock the test moves by hand. */
function manualClock(start: Date) {
  let now = start.getTime()
  return {
    clock: () => new Date(now),
    advance: (ms: number) => {
      now += ms
    },
  }
}

describe('gradeFor', () => {
  it('maps wrong to again, whatever the time', () => {
    expect(gradeFor('wrong', 1_000)).toBe('again')
    expect(gradeFor('wrong', 60_000)).toBe('again')
  })

  it('maps a near miss to hard, never a failure (SPEC.md), whatever the time', () => {
    expect(gradeFor('nearMiss', 1_000)).toBe('hard')
    expect(gradeFor('nearMiss', 60_000)).toBe('hard')
  })

  it('maps correct to easy / good / hard by response time', () => {
    expect(gradeFor('correct', 4_000)).toBe('easy')
    expect(gradeFor('correct', 5_000)).toBe('good')
    expect(gradeFor('correct', 20_000)).toBe('good')
    expect(gradeFor('correct', 20_001)).toBe('hard')
  })

  it('accepts custom thresholds', () => {
    const thresholds = { easyUnderMs: 1_000, hardOverMs: 2_000 }
    expect(gradeFor('correct', 999, thresholds)).toBe('easy')
    expect(gradeFor('correct', 1_500, thresholds)).toBe('good')
    expect(gradeFor('correct', 2_500, thresholds)).toBe('hard')
  })
})

describe('createScheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a new card due now, per the injected clock', () => {
    const { clock } = manualClock(T0)
    const card = createScheduler(clock).newCard()
    expect(isNew(card)).toBe(true)
    expect(card.due).toEqual(T0)
    expect(card.reps).toBe(0)
  })

  it('schedules a reviewed card into the future and logs the review time', () => {
    const { clock } = manualClock(T0)
    const scheduler = createScheduler(clock)
    const { card, log } = scheduler.review(scheduler.newCard(), 'good')
    expect(isNew(card)).toBe(false)
    expect(card.reps).toBe(1)
    expect(card.due.getTime()).toBeGreaterThan(T0.getTime())
    expect(log.review).toEqual(T0)
  })

  it('gives a longer interval for easy than for good than for again', () => {
    const { clock, advance } = manualClock(T0)
    const scheduler = createScheduler(clock)
    // Graduate a card to the review state first, then compare its next step.
    let card = scheduler.newCard()
    card = scheduler.review(card, 'easy').card
    advance(card.due.getTime() - T0.getTime())
    const again = scheduler.review(card, 'again').card.due.getTime()
    const good = scheduler.review(card, 'good').card.due.getTime()
    const easy = scheduler.review(card, 'easy').card.due.getTime()
    expect(again).toBeLessThan(good)
    expect(good).toBeLessThan(easy)
  })

  it('counts a lapse when a review-state card is failed', () => {
    const { clock, advance } = manualClock(T0)
    const scheduler = createScheduler(clock)
    let card = scheduler.review(scheduler.newCard(), 'easy').card
    advance(10 * DAY)
    card = scheduler.review(card, 'again').card
    expect(card.lapses).toBe(1)
  })

  it('is deterministic: same card, same clock, same grade → same result', () => {
    const { clock } = manualClock(T0)
    const a = createScheduler(clock)
    const b = createScheduler(clock)
    expect(a.review(a.newCard(), 'good')).toEqual(b.review(b.newCard(), 'good'))
  })

  it('never reads the system clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2001-01-01T00:00:00.000Z'))
    const { clock } = manualClock(T0)
    const scheduler = createScheduler(clock)
    const card = scheduler.newCard()
    const { card: reviewed, log } = scheduler.review(card, 'good')
    expect(card.due).toEqual(T0)
    expect(log.review).toEqual(T0)
    expect(reviewed.due.getTime()).toBeGreaterThan(T0.getTime())
  })

  it('does not mutate the card it was given', () => {
    const { clock } = manualClock(T0)
    const scheduler = createScheduler(clock)
    const card = scheduler.newCard()
    const snapshot = structuredClone(card)
    scheduler.review(card, 'again')
    expect(card).toEqual(snapshot)
  })
})
