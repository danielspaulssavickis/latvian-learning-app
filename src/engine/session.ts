import { compareContentOrder, type CardSpec } from './cards'
import { isNew, type SchedulingState } from './schedule'

/** A card as persisted: its content-derived spec plus scheduling state. */
export interface StoredCard extends CardSpec {
  fsrs: SchedulingState
  /**
   * The content that produced this card is gone (sentence removed or token no
   * longer drillable). Kept, not deleted, so its review history survives if
   * the content comes back (ADR-009); never scheduled while retired.
   */
  retired: boolean
}

export interface DailyLimits {
  newPerDay: number
  reviewsPerDay: number
}

export const DEFAULT_DAILY_LIMITS: DailyLimits = { newPerDay: 10, reviewsPerDay: 100 }

/** How many of each were already done today — counted from the review log by the caller. */
export interface DoneToday {
  newCards: number
  reviews: number
}

export interface Session {
  reviews: StoredCard[]
  newCards: StoredCard[]
}

/**
 * Picks what to study now: due reviews (learning cards included), most
 * overdue first, and unseen cards in content order, each capped by the daily
 * limit minus what was already done today. `now` is passed in — no clock
 * reads here.
 */
export function selectSession(
  cards: readonly StoredCard[],
  now: Date,
  limits: DailyLimits,
  doneToday: DoneToday,
): Session {
  const active = cards.filter((card) => !card.retired)
  const reviewRoom = Math.max(0, limits.reviewsPerDay - doneToday.reviews)
  const newRoom = Math.max(0, limits.newPerDay - doneToday.newCards)

  const reviews = active
    .filter((card) => !isNew(card.fsrs) && card.fsrs.due.getTime() <= now.getTime())
    .sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime())
    .slice(0, reviewRoom)

  const newCards = active
    .filter((card) => isNew(card.fsrs))
    .sort(compareContentOrder)
    .slice(0, newRoom)

  return { reviews, newCards }
}
