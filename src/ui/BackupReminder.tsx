import { getSettings } from '../db/settings'
import { shouldRemindBackup } from '../engine/backupReminder'
import { useApp } from './appContext'
import { useLiveQuery } from './useLiveQuery'

/** A gentle nudge to export progress (ADR-013); nothing when there's nothing to lose. */
export function BackupReminder() {
  const { db, clock } = useApp()
  const remind = useLiveQuery(async () => {
    const [settings, reviewCount] = await Promise.all([getSettings(db), db.reviews.count()])
    return shouldRemindBackup(settings.lastExportAt, reviewCount, clock())
  }, [db, clock])
  if (!remind) return null
  return (
    <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100">
      Your progress lives only in this browser. Export a backup in Settings — it takes a second and
      protects your review history if the browser clears its storage.
    </p>
  )
}
