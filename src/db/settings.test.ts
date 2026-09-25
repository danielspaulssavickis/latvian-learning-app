import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { openDb } from './db'
import { DEFAULT_SETTINGS, getSettings, updateSettings } from './settings'

function freshDb() {
  return openDb('test', { indexedDB: new IDBFactory(), IDBKeyRange })
}

describe('settings', () => {
  it('returns the defaults when nothing is stored', async () => {
    expect(await getSettings(freshDb())).toEqual(DEFAULT_SETTINGS)
  })

  it('persists a partial update and keeps the rest', async () => {
    const db = freshDb()
    await updateSettings(db, { dailyLimits: { newPerDay: 5, reviewsPerDay: 50 } })
    const when = new Date('2026-09-25T10:00:00.000Z')
    await updateSettings(db, { lastExportAt: when })
    expect(await getSettings(db)).toEqual({
      dailyLimits: { newPerDay: 5, reviewsPerDay: 50 },
      lastExportAt: when,
    })
  })
})
