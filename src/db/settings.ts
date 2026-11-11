import { DEFAULT_DAILY_LIMITS, localDayKey, type DailyLimits } from '../engine/session'
import type { TrainerDb } from './db'

export interface Settings {
  dailyLimits: DailyLimits
  /** When progress was last exported — drives the backup reminder (ADR-012). */
  lastExportAt: Date | null
  /** Extra new cards allowed on one day only ("Learn more" on the Review screen). */
  extraNew: { day: string; count: number } | null
  /** One new card per sentence per day (ADR-012). Off = all of a sentence's cards may come the same day. */
  burySiblings: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  dailyLimits: DEFAULT_DAILY_LIMITS,
  lastExportAt: null,
  extraNew: null,
  burySiblings: true,
}

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

/** Today's limits: the daily limits plus any extra new cards granted for today. */
export function limitsFor(settings: Settings, now: Date): DailyLimits {
  const extra = settings.extraNew?.day === localDayKey(now) ? settings.extraNew.count : 0
  return { ...settings.dailyLimits, newPerDay: settings.dailyLimits.newPerDay + extra }
}

/** Allows `count` more new cards today only; resets by itself tomorrow. */
export async function addExtraNewToday(db: TrainerDb, now: Date, count: number): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const settings = await getSettings(db)
    const day = localDayKey(now)
    const already = settings.extraNew?.day === day ? settings.extraNew.count : 0
    return updateSettings(db, { extraNew: { day, count: already + count } })
  })
}
