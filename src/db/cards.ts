import type { CardSpec } from '../engine/cards'
import type { CheckResult } from '../engine/checkAnswer'
import {
  gradeFor,
  isNew,
  type Grade,
  type GradeThresholds,
  type Scheduler,
} from '../engine/schedule'
import {
  selectSession,
  type DailyLimits,
  type DoneToday,
  type Session,
  type StoredCard,
} from '../engine/session'
import type { TrainerDb } from './db'

export interface SyncResult {
  added: number
  updated: number
  retired: number
  revived: number
}

function sameSpec(card: StoredCard, spec: CardSpec): boolean {
  return (
    card.kind === spec.kind &&
    card.targetId === spec.targetId &&
    card.sentenceId === spec.sentenceId &&
    card.tokenIndex === spec.tokenIndex &&
    card.feature === spec.feature &&
    card.features.join('|') === spec.features.join('|')
  )
}

/**
 * Brings the stored cards in line with freshly generated specs (ADR-009):
 * adds unseen cards as new, refreshes a card's content-derived fields if they
 * changed, retires cards whose content is gone and revives them if it comes
 * back. Scheduling state and the review log are never touched, so adding
 * content can't orphan a learner's history.
 */
export async function syncCards(
  db: TrainerDb,
  specs: readonly CardSpec[],
  scheduler: Scheduler,
): Promise<SyncResult> {
  return db.transaction('rw', db.cards, async () => {
    const result: SyncResult = { added: 0, updated: 0, retired: 0, revived: 0 }
    const existing = new Map((await db.cards.toArray()).map((card) => [card.id, card]))
    const writes: StoredCard[] = []

    for (const spec of specs) {
      const card = existing.get(spec.id)
      existing.delete(spec.id)
      if (!card) {
        writes.push({ ...spec, fsrs: scheduler.newCard(), retired: false })
        result.added += 1
        continue
      }
      const changed = !sameSpec(card, spec)
      if (!changed && !card.retired) continue
      if (card.retired) result.revived += 1
      if (changed) result.updated += 1
      writes.push({ ...card, ...spec, retired: false })
    }

    for (const card of existing.values()) {
      if (card.retired) continue
      writes.push({ ...card, retired: true })
      result.retired += 1
    }

    await db.cards.bulkPut(writes)
    return result
  })
}

export interface ReviewInput {
  cardId: string
  result: CheckResult
  given: string
  responseMs: number
}

/**
 * Grades an answer, reschedules the card and appends to the review log, in
 * one transaction. The review time comes from the scheduler's injected clock.
 */
export async function recordReview(
  db: TrainerDb,
  scheduler: Scheduler,
  input: ReviewInput,
  thresholds?: GradeThresholds,
): Promise<{ grade: Grade; card: StoredCard }> {
  return db.transaction('rw', db.cards, db.reviews, async () => {
    const card = await db.cards.get(input.cardId)
    if (!card) throw new Error(`recordReview: no card with id ${input.cardId}`)

    const grade = gradeFor(input.result, input.responseMs, thresholds)
    const next = scheduler.review(card.fsrs, grade)
    const updated: StoredCard = { ...card, fsrs: next.card }

    await db.cards.put(updated)
    await db.reviews.add({
      cardId: card.id,
      feature: card.feature,
      features: card.features,
      reviewedAt: next.log.review,
      result: input.result,
      given: input.given,
      responseMs: input.responseMs,
      grade,
      wasNew: isNew(card.fsrs),
      fsrsLog: next.log,
    })
    return { grade, card: updated }
  })
}

/**
 * New cards introduced and reviews done since `since` (the caller's local
 * start of day), plus which sentences they came from (for sibling burying).
 */
export async function countDoneSince(db: TrainerDb, since: Date): Promise<DoneToday> {
  let newCards = 0
  let reviews = 0
  const cardIds = new Set<string>()
  await db.reviews
    .where('reviewedAt')
    .aboveOrEqual(since)
    .each((review) => {
      if (review.wasNew) newCards += 1
      else reviews += 1
      cardIds.add(review.cardId)
    })
  const cards = await db.cards.bulkGet([...cardIds])
  const sentenceIds = new Set(cards.flatMap((card) => (card ? [card.sentenceId] : [])))
  return { newCards, reviews, sentenceIds }
}

/** What to study right now, honoring the daily caps from `dayStart` onward. */
export async function loadSession(
  db: TrainerDb,
  now: Date,
  limits: DailyLimits,
  dayStart: Date,
): Promise<Session> {
  const [cards, doneToday] = await Promise.all([db.cards.toArray(), countDoneSince(db, dayStart)])
  return selectSession(cards, now, limits, doneToday)
}
