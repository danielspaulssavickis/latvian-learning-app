import { describe, expect, it } from 'vitest'
import type { CardSpec } from './cards'
import { createScheduler } from './schedule'
import { selectSession, startOfLocalDay, type StoredCard } from './session'

const NOW = new Date('2026-09-25T09:00:00.000Z')
const HOUR = 60 * 60_000
const scheduler = createScheduler(() => NOW)

function spec(sentenceId: string, tokenIndex: number): CardSpec {
  const targetId = `${sentenceId}#${tokenIndex}`
  return {
    id: `cloze:${targetId}`,
    kind: 'cloze',
    targetId,
    sentenceId,
    tokenIndex,
    feature: 'case:loc',
    features: ['case:loc'],
  }
}

function newCard(sentenceId: string, tokenIndex = 0): StoredCard {
  return { ...spec(sentenceId, tokenIndex), fsrs: scheduler.newCard(), retired: false }
}

/** A card that has been reviewed once and is due at `due`. */
function reviewCard(sentenceId: string, due: Date): StoredCard {
  const { card } = scheduler.review(scheduler.newCard(), 'good')
  return { ...spec(sentenceId, 0), fsrs: { ...card, due }, retired: false }
}

const limits = { newPerDay: 2, reviewsPerDay: 3 }
const nothingDone = { newCards: 0, reviews: 0 }

describe('selectSession', () => {
  it('introduces new cards in content order, capped at the daily limit', () => {
    const cards = [newCard('snt_0003'), newCard('snt_0001', 2), newCard('snt_0001', 0)]
    const session = selectSession(cards, NOW, limits, nothingDone)
    expect(session.newCards.map((c) => c.id)).toEqual(['cloze:snt_0001#0', 'cloze:snt_0001#2'])
  })

  it('takes only reviews that are due, most overdue first, capped', () => {
    const cards = [
      reviewCard('snt_a', new Date(NOW.getTime() - 1 * HOUR)),
      reviewCard('snt_b', new Date(NOW.getTime() + 1 * HOUR)), // not due yet
      reviewCard('snt_c', new Date(NOW.getTime() - 5 * HOUR)),
      reviewCard('snt_d', new Date(NOW.getTime() - 3 * HOUR)),
      reviewCard('snt_e', new Date(NOW.getTime() - 2 * HOUR)),
    ]
    const session = selectSession(cards, NOW, limits, nothingDone)
    expect(session.reviews.map((c) => c.sentenceId)).toEqual(['snt_c', 'snt_d', 'snt_e'])
  })

  it('subtracts what was already done today from both caps', () => {
    const cards = [
      newCard('snt_0001'),
      newCard('snt_0002'),
      reviewCard('snt_a', NOW),
      reviewCard('snt_b', NOW),
    ]
    const session = selectSession(cards, NOW, limits, { newCards: 1, reviews: 2 })
    expect(session.newCards).toHaveLength(1)
    expect(session.reviews).toHaveLength(1)
  })

  it('never goes negative when today already exceeds the cap', () => {
    const session = selectSession([newCard('snt_0001')], NOW, limits, {
      newCards: 5,
      reviews: 9,
    })
    expect(session).toEqual({ newCards: [], reviews: [] })
  })

  it('skips retired cards', () => {
    const retired = { ...newCard('snt_0001'), retired: true }
    const session = selectSession([retired], NOW, limits, nothingDone)
    expect(session.newCards).toEqual([])
  })
})

describe('startOfLocalDay', () => {
  it('is local midnight of the same day', () => {
    const noon = new Date(2026, 8, 25, 12, 30)
    expect(startOfLocalDay(noon)).toEqual(new Date(2026, 8, 25, 0, 0))
    expect(startOfLocalDay(new Date(2026, 8, 25, 0, 0))).toEqual(new Date(2026, 8, 25, 0, 0))
  })
})
