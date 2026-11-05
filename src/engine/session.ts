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

/** What was already done today — counted from the review log by the caller. */
export interface DoneToday {
  newCards: number
  reviews: number
  /** Sentences any card was reviewed from today; their new siblings wait (see selectSession). */
  sentenceIds?: ReadonlySet<string>
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
 *
 * New cards are *sibling-buried* (ADR-012): at most one new card per
 * sentence per day, and none from a sentence already studied today. Without
 * that, "Give the form: Rīga → locative" would follow right after the cloze
 * whose answer was "Rīgā", and a produce card right after the recognize card
 * that showed its sentence — tests of short-term memory, not learning.
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

  const busy = new Set(doneToday.sentenceIds ?? [])
  const newCards: StoredCard[] = []
  for (const card of active.filter((c) => isNew(c.fsrs)).sort(compareContentOrder)) {
    if (newCards.length >= newRoom) break
    if (busy.has(card.sentenceId)) continue
    busy.add(card.sentenceId)
    newCards.push(card)
  }

  return { reviews, newCards }
}

/**
 * Local midnight at or before `now` — the boundary the daily caps reset at.
 * Uses the runtime's time zone, not the clock: `now` is always passed in.
 */
export function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** A local calendar day as "YYYY-MM-DD" — the key for today-only settings. */
export function localDayKey(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** When the next already-seen card falls due after `now`, or null if none will. */
export function nextDueAt(cards: readonly StoredCard[], now: Date): Date | null {
  let next: Date | null = null
  for (const card of cards) {
    if (card.retired || isNew(card.fsrs)) continue
    const due = card.fsrs.due
    if (due.getTime() > now.getTime() && (next === null || due < next)) next = due
  }
  return next
}

/**
 * How many more new cards could be introduced today if the daily cap
 * allowed it (sibling burying still applies) — what "learn more" can offer.
 */
export function newCardsAvailable(
  cards: readonly StoredCard[],
  now: Date,
  doneToday: DoneToday,
): number {
  const uncapped = { newPerDay: Number.MAX_SAFE_INTEGER, reviewsPerDay: 0 }
  return selectSession(cards, now, uncapped, { ...doneToday, newCards: 0 }).newCards.length
}
