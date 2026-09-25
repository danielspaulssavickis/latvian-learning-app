import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { FIXTURE_LEXEMES, SNT_1, SNT_10, SNT_3 } from '../engine/__fixtures__/sentences'
import { generateCards } from '../engine/cards'
import { createScheduler, isNew } from '../engine/schedule'
import { countDoneSince, loadSession, recordReview, syncCards } from './cards'
import { openDb, type TrainerDb } from './db'

const T0 = new Date('2026-09-25T09:00:00.000Z')
const MINUTE = 60_000

let indexedDB: IDBFactory
let now: Date
let db: TrainerDb
const scheduler = createScheduler(() => now)

function reopen(): TrainerDb {
  return openDb('test', { indexedDB, IDBKeyRange })
}

beforeEach(() => {
  // A fresh in-memory IndexedDB per test: nothing leaks between tests.
  indexedDB = new IDBFactory()
  now = T0
  db = reopen()
})

describe('syncCards', () => {
  it('adds one new card per spec, due now', async () => {
    const result = await syncCards(db, generateCards([SNT_1, SNT_3], FIXTURE_LEXEMES), scheduler)
    expect(result).toEqual({ added: 3, updated: 0, retired: 0, revived: 0 })
    const cards = await db.cards.toArray()
    expect(cards).toHaveLength(3)
    for (const card of cards) {
      expect(isNew(card.fsrs)).toBe(true)
      expect(card.fsrs.due).toEqual(T0)
      expect(card.retired).toBe(false)
    }
  })

  it('is idempotent', async () => {
    const specs = generateCards([SNT_1, SNT_3], FIXTURE_LEXEMES)
    await syncCards(db, specs, scheduler)
    expect(await syncCards(db, specs, scheduler)).toEqual({
      added: 0,
      updated: 0,
      retired: 0,
      revived: 0,
    })
  })

  it('adding a sentence never touches existing cards or their review history', async () => {
    await syncCards(db, generateCards([SNT_1, SNT_10], FIXTURE_LEXEMES), scheduler)
    await recordReview(db, scheduler, {
      cardId: 'cloze:snt_0001#2',
      result: 'correct',
      given: 'Rīgā',
      responseMs: 8_000,
    })
    now = new Date(T0.getTime() + 20 * MINUTE)
    await recordReview(db, scheduler, {
      cardId: 'cloze:snt_0001#2',
      result: 'nearMiss',
      given: 'Riga',
      responseMs: 8_000,
    })
    const cardsBefore = await db.cards.toArray()
    const reviewsBefore = await db.reviews.toArray()

    // New content arrives; cards are regenerated from scratch and re-synced.
    now = new Date(T0.getTime() + 60 * MINUTE)
    const result = await syncCards(
      db,
      generateCards([SNT_1, SNT_3, SNT_10], FIXTURE_LEXEMES),
      scheduler,
    )

    expect(result).toEqual({ added: 2, updated: 0, retired: 0, revived: 0 })
    for (const before of cardsBefore) {
      expect(await db.cards.get(before.id)).toEqual(before)
    }
    expect(await db.reviews.toArray()).toEqual(reviewsBefore)
    const reviewed = await db.cards.get('cloze:snt_0001#2')
    expect(reviewed?.fsrs.reps).toBe(2)
    const added = await db.cards.get('cloze:snt_0003#3')
    expect(added && isNew(added.fsrs)).toBe(true)
  })

  it('retires a card whose content disappeared, and revives it with its state intact', async () => {
    await syncCards(db, generateCards([SNT_1, SNT_10], FIXTURE_LEXEMES), scheduler)
    await recordReview(db, scheduler, {
      cardId: 'cloze:snt_0010#2',
      result: 'correct',
      given: 'dārzā',
      responseMs: 8_000,
    })
    const reviewedState = (await db.cards.get('cloze:snt_0010#2'))?.fsrs

    expect(await syncCards(db, generateCards([SNT_1], FIXTURE_LEXEMES), scheduler)).toEqual({
      added: 0,
      updated: 0,
      retired: 1,
      revived: 0,
    })
    expect(await db.cards.get('cloze:snt_0010#2')).toMatchObject({
      retired: true,
      fsrs: reviewedState,
    })

    expect(await syncCards(db, generateCards([SNT_1, SNT_10], FIXTURE_LEXEMES), scheduler)).toEqual(
      { added: 0, updated: 0, retired: 0, revived: 1 },
    )
    expect(await db.cards.get('cloze:snt_0010#2')).toMatchObject({
      retired: false,
      fsrs: reviewedState,
    })
  })

  it("updates a card's features when its content changed, keeping its schedule", async () => {
    const [spec] = generateCards([SNT_1], FIXTURE_LEXEMES)
    await syncCards(db, [spec], scheduler)
    await recordReview(db, scheduler, {
      cardId: spec.id,
      result: 'correct',
      given: 'Rīgā',
      responseMs: 8_000,
    })
    const scheduled = (await db.cards.get(spec.id))?.fsrs

    const retagged = { ...spec, feature: 'case:acc', features: ['case:acc', 'number:sg'] }
    expect(await syncCards(db, [retagged], scheduler)).toMatchObject({ updated: 1 })
    expect(await db.cards.get(spec.id)).toMatchObject({ feature: 'case:acc', fsrs: scheduled })
  })
})

describe('recordReview', () => {
  beforeEach(async () => {
    await syncCards(db, generateCards([SNT_1], FIXTURE_LEXEMES), scheduler)
  })

  it('reschedules the card and appends a review log entry', async () => {
    const outcome = await recordReview(db, scheduler, {
      cardId: 'cloze:snt_0001#2',
      result: 'nearMiss',
      given: 'Riga',
      responseMs: 3_000,
    })
    expect(outcome.grade).toBe('hard')

    const card = await db.cards.get('cloze:snt_0001#2')
    expect(card?.fsrs.reps).toBe(1)
    expect(card?.fsrs.due.getTime()).toBeGreaterThan(T0.getTime())

    const [log] = await db.reviews.toArray()
    expect(log).toMatchObject({
      cardId: 'cloze:snt_0001#2',
      feature: 'case:loc',
      features: ['case:loc', 'number:sg', 'declension:4'],
      reviewedAt: T0,
      result: 'nearMiss',
      given: 'Riga',
      responseMs: 3_000,
      grade: 'hard',
      wasNew: true,
    })
  })

  it('makes the review log queryable by feature', async () => {
    await recordReview(db, scheduler, {
      cardId: 'cloze:snt_0001#2',
      result: 'wrong',
      given: 'Rīgu',
      responseMs: 3_000,
    })
    expect(await db.reviews.where('features').equals('declension:4').count()).toBe(1)
    expect(await db.reviews.where('features').equals('case:gen').count()).toBe(0)
  })

  it('rejects an unknown card id and writes nothing', async () => {
    await expect(
      recordReview(db, scheduler, {
        cardId: 'cloze:nope#0',
        result: 'correct',
        given: 'x',
        responseMs: 1,
      }),
    ).rejects.toThrow(/cloze:nope#0/)
    expect(await db.reviews.count()).toBe(0)
  })
})

describe('countDoneSince / loadSession', () => {
  it('splits today’s reviews into new cards and reviews, ignoring earlier days', async () => {
    await syncCards(db, generateCards([SNT_1, SNT_3], FIXTURE_LEXEMES), scheduler)
    const review = (cardId: string) =>
      recordReview(db, scheduler, { cardId, result: 'correct', given: 'x', responseMs: 8_000 })

    now = new Date('2026-09-24T20:00:00.000Z') // yesterday
    await review('cloze:snt_0003#0')
    now = T0
    await review('cloze:snt_0001#2') // new today
    now = new Date(T0.getTime() + 15 * MINUTE)
    await review('cloze:snt_0001#2') // same card again: a review now

    const dayStart = new Date('2026-09-25T00:00:00.000Z')
    expect(await countDoneSince(db, dayStart)).toEqual({
      newCards: 1,
      reviews: 1,
      sentenceIds: new Set(['snt_0001']),
    })
  })

  it('survives closing and reopening the database (the M3 done-when, data side)', async () => {
    await syncCards(db, generateCards([SNT_1, SNT_3, SNT_10], FIXTURE_LEXEMES), scheduler)
    await recordReview(db, scheduler, {
      cardId: 'cloze:snt_0001#2',
      result: 'correct',
      given: 'Rīgā',
      responseMs: 8_000,
    })
    const saved = await db.cards.get('cloze:snt_0001#2')
    db.close()

    const reopened = reopen()
    expect(await reopened.cards.get('cloze:snt_0001#2')).toEqual(saved)
    expect(await reopened.reviews.count()).toBe(1)

    const session = await loadSession(reopened, T0, { newPerDay: 10, reviewsPerDay: 100 }, T0)
    // snt_0003's second card is buried until tomorrow (one new card per sentence per day).
    expect(session.newCards.map((c) => c.id)).toEqual(['cloze:snt_0003#0', 'cloze:snt_0010#2'])
    reopened.close()
  })
})
