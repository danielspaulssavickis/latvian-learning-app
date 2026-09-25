import { Dexie, type DexieOptions, type EntityTable } from 'dexie'
import type { CheckResult } from '../engine/checkAnswer'
import type { Clock, Grade, SchedulingLog } from '../engine/schedule'
import type { StoredCard } from '../engine/session'

/** One answer, append-only. The source for per-feature retention (M4) and export (ADR-002). */
export interface ReviewRecord {
  id?: number
  cardId: string
  feature: string
  /** Copied from the card at review time, so history stays attributable if content changes. */
  features: string[]
  reviewedAt: Date
  result: CheckResult
  given: string
  responseMs: number
  grade: Grade
  /** The card had never been reviewed before — counts against the daily new-card cap. */
  wasNew: boolean
  fsrsLog: SchedulingLog
}

export type TrainerDb = Dexie & {
  cards: EntityTable<StoredCard, 'id'>
  reviews: EntityTable<ReviewRecord, 'id'>
}

/**
 * The app's IndexedDB (ADR-002: no backend). `options` lets tests pass an
 * in-memory IndexedDB; the app calls this with no options.
 *
 * Schema changes need a new `db.version(n)` block — never edit version 1
 * once it has shipped, or existing review history won't open.
 */
export function openDb(name = 'latvian-trainer', options?: DexieOptions): TrainerDb {
  const db = new Dexie(name, options) as TrainerDb
  db.version(1).stores({
    cards: 'id, sentenceId, feature, fsrs.due',
    reviews: '++id, cardId, reviewedAt, *features',
  })
  return db
}

/** The one real clock. Lives outside src/engine/ so the engine never reads the system time. */
export const systemClock: Clock = () => new Date()
