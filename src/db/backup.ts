import { z } from 'zod'
import type { StoredCard } from '../engine/session'
import type { ReviewRecord, TrainerDb } from './db'
import { updateSettings, type Settings } from './settings'

/**
 * JSON export/import of all progress — the backup path of ADR-002 (no
 * server) and the mitigation for browser storage eviction (ADR-013).
 */
export const BACKUP_FORMAT = 'latvian-trainer-progress'
export const BACKUP_VERSION = 1

const isoDate = z.iso.datetime().transform((value) => new Date(value))

const fsrsSchema = z.looseObject({
  due: isoDate,
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  learning_steps: z.number(),
  reps: z.number().int(),
  lapses: z.number().int(),
  state: z.number().int(),
  last_review: isoDate.optional(),
})

const cardSchema = z.looseObject({
  id: z.string().min(1),
  kind: z.enum(['recognize', 'cloze', 'inflect', 'produce', 'listen']),
  targetId: z.string(),
  sentenceId: z.string(),
  tokenIndex: z.number().int().nullable(),
  feature: z.string(),
  features: z.array(z.string()),
  fsrs: fsrsSchema,
  retired: z.boolean(),
})

const reviewSchema = z.looseObject({
  id: z.number().int().optional(),
  cardId: z.string().min(1),
  feature: z.string(),
  features: z.array(z.string()),
  reviewedAt: isoDate,
  result: z.enum(['correct', 'nearMiss', 'wrong']),
  given: z.string(),
  responseMs: z.number(),
  grade: z.enum(['again', 'hard', 'good', 'easy']),
  wasNew: z.boolean(),
  fsrsLog: z.looseObject({ due: isoDate, review: isoDate }),
})

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.iso.datetime(),
  cards: z.array(cardSchema),
  reviews: z.array(reviewSchema),
  settings: z
    .object({
      dailyLimits: z.object({
        newPerDay: z.number().int().min(0),
        reviewsPerDay: z.number().int().min(0),
      }),
      lastExportAt: isoDate.nullable(),
    })
    .partial(),
})

/** Serializes everything and records the export time (drives the backup reminder). */
export async function exportProgress(db: TrainerDb, now: Date): Promise<string> {
  const settings = await updateSettings(db, { lastExportAt: now })
  const [cards, reviews] = await Promise.all([db.cards.toArray(), db.reviews.toArray()])
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    cards,
    reviews,
    settings,
  })
}

/**
 * Validates a backup and, only if it's entirely valid, replaces all cards,
 * reviews and settings with it in one transaction. The caller should re-run
 * syncCards afterwards so the cards match the current content.
 */
export async function importProgress(
  db: TrainerDb,
  json: string,
): Promise<{ cards: number; reviews: number }> {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('That file is not JSON.')
  }
  const format = (raw as { format?: unknown } | null)?.format
  if (format !== BACKUP_FORMAT)
    throw new Error('That file is not a Latvian Trainer progress backup.')
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(`The backup is damaged at ${issue.path.join('.')}: ${issue.message}`)
  }

  const { cards, reviews, settings } = parsed.data
  await db.transaction('rw', db.cards, db.reviews, db.settings, async () => {
    await Promise.all([db.cards.clear(), db.reviews.clear(), db.settings.clear()])
    await db.cards.bulkAdd(cards as unknown as StoredCard[])
    await db.reviews.bulkAdd(reviews as unknown as ReviewRecord[])
    await updateSettings(db, settings as Partial<Settings>)
  })
  return { cards: cards.length, reviews: reviews.length }
}
