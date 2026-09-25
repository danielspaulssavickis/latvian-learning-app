import { DEFAULT_DAILY_LIMITS, type DailyLimits } from '../engine/session'
import type { TrainerDb } from './db'

export interface Settings {
  dailyLimits: DailyLimits
  /** When progress was last exported — drives the backup reminder (ADR-012). */
  lastExportAt: Date | null
}

export const DEFAULT_SETTINGS: Settings = { dailyLimits: DEFAULT_DAILY_LIMITS, lastExportAt: null }

const KEY = 'settings'

/** Stored settings merged over the defaults, so a new setting never reads as undefined. */
export async function getSettings(db: TrainerDb): Promise<Settings> {
  const row = await db.settings.get(KEY)
  const stored = (row?.value ?? {}) as Partial<Settings>
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    dailyLimits: { ...DEFAULT_SETTINGS.dailyLimits, ...stored.dailyLimits },
  }
}

export async function updateSettings(db: TrainerDb, patch: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const next = { ...(await getSettings(db)), ...patch }
    await db.settings.put({ key: KEY, value: next })
    return next
  })
}
