export const BACKUP_REMINDER_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Whether to nudge for a progress export (ADR-013): there is history worth
 * losing and it hasn't been exported in the last week. Browser storage can
 * be evicted (notably iOS Safari for a home-screen app), and export is the
 * only backup there is.
 */
export function shouldRemindBackup(
  lastExportAt: Date | null,
  reviewCount: number,
  now: Date,
): boolean {
  if (reviewCount === 0) return false
  if (lastExportAt === null) return true
  return now.getTime() - lastExportAt.getTime() >= BACKUP_REMINDER_DAYS * DAY_MS
}
