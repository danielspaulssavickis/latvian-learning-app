import { describe, expect, it } from 'vitest'
import { cardStats, isSkill } from './progress'
import { createScheduler } from './schedule'
import type { StoredCard } from './session'

const NOW = new Date('2026-09-25T09:00:00.000Z')
const scheduler = createScheduler(() => NOW)

function card(id: string, seenDue: Date | null, retired = false): StoredCard {
  const fsrs = seenDue
    ? { ...scheduler.review(scheduler.newCard(), 'good').card, due: seenDue }
    : scheduler.newCard()
  return {
    id,
    kind: 'cloze',
    targetId: id,
    sentenceId: id,
    tokenIndex: 0,
    feature: 'case:loc',
    features: [],
    fsrs,
    retired,
  }
}

describe('cardStats', () => {
  it('counts active, seen and due cards', () => {
    const cards = [
      card('a', null),
      card('b', new Date(NOW.getTime() - 1)),
      card('c', new Date(NOW.getTime() + 60_000)),
      card('d', new Date(NOW.getTime() - 1), true),
    ]
    expect(cardStats(cards, NOW)).toEqual({ total: 3, seen: 2, dueNow: 1 })
  })
})

describe('isSkill', () => {
  it('separates skills from grammar features', () => {
    expect(isSkill('skill:produce')).toBe(true)
    expect(isSkill('case:loc')).toBe(false)
  })
})
