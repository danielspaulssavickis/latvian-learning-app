import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { FIXTURE_LEXEMES, SNT_1, SNT_3 } from '../engine/__fixtures__/sentences'
import { generateCards } from '../engine/cards'
import { createScheduler } from '../engine/schedule'
import { exportProgress, importProgress } from './backup'
import { recordReview, syncCards } from './cards'
import { openDb, type TrainerDb } from './db'
import { getSettings, updateSettings } from './settings'

const T0 = new Date('2026-09-25T09:00:00.000Z')
const scheduler = createScheduler(() => T0)
const freshDb = () => openDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })

let source: TrainerDb
beforeEach(async () => {
  source = freshDb()
  await syncCards(source, generateCards([SNT_1, SNT_3], FIXTURE_LEXEMES), scheduler)
  await recordReview(source, scheduler, {
    cardId: 'cloze:snt_0001#2',
    result: 'nearMiss',
    given: 'Riga',
    responseMs: 4000,
  })
  await updateSettings(source, { dailyLimits: { newPerDay: 3, reviewsPerDay: 30 } })
})

describe('exportProgress / importProgress', () => {
  it('round-trips cards, the review log and settings, Dates included', async () => {
    const json = await exportProgress(source, T0)
    const target = freshDb()
    expect(await importProgress(target, json)).toEqual({ cards: 3, reviews: 1 })

    expect(await target.cards.orderBy('id').toArray()).toEqual(
      await source.cards.orderBy('id').toArray(),
    )
    expect(await target.reviews.toArray()).toEqual(await source.reviews.toArray())
    const [card] = await target.cards.where('id').equals('cloze:snt_0001#2').toArray()
    expect(card.fsrs.due).toBeInstanceOf(Date)
    expect((await getSettings(target)).dailyLimits).toEqual({ newPerDay: 3, reviewsPerDay: 30 })
  })

  it('records the export time in settings and in the file', async () => {
    const json = await exportProgress(source, T0)
    expect(JSON.parse(json)).toMatchObject({
      format: 'latvian-trainer-progress',
      version: 1,
      exportedAt: T0.toISOString(),
    })
    expect((await getSettings(source)).lastExportAt).toEqual(T0)
  })

  it('replaces whatever was there before', async () => {
    const json = await exportProgress(source, T0)
    const target = freshDb()
    await syncCards(target, generateCards([SNT_3], FIXTURE_LEXEMES), scheduler)
    await recordReview(target, scheduler, {
      cardId: 'cloze:snt_0003#0',
      result: 'wrong',
      given: 'x',
      responseMs: 1,
    })
    await importProgress(target, json)
    expect(await target.reviews.count()).toBe(1)
    expect((await target.reviews.toArray())[0].cardId).toBe('cloze:snt_0001#2')
  })

  it.each([
    ['not JSON', 'nope{'],
    ['another format', JSON.stringify({ format: 'something-else', version: 1 })],
    ['a newer version', JSON.stringify({ format: 'latvian-trainer-progress', version: 2 })],
  ])('rejects %s and leaves the database untouched', async (_label, json) => {
    const before = await source.reviews.count()
    await expect(importProgress(source, json)).rejects.toThrow()
    expect(await source.reviews.count()).toBe(before)
  })

  it('rejects a malformed card with a useful message', async () => {
    const data = JSON.parse(await exportProgress(source, T0))
    data.cards[0].fsrs.due = 'yesterday'
    await expect(importProgress(freshDb(), JSON.stringify(data))).rejects.toThrow(
      /cards\.0\.fsrs\.due/,
    )
  })
})
