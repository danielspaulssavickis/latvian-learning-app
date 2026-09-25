import { describe, expect, it } from 'vitest'
import { shouldRemindBackup } from './backupReminder'

const NOW = new Date('2026-09-25T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

describe('shouldRemindBackup', () => {
  it('stays quiet with no history', () => {
    expect(shouldRemindBackup(null, 0, NOW)).toBe(false)
  })

  it('reminds when there is history and no export yet', () => {
    expect(shouldRemindBackup(null, 1, NOW)).toBe(true)
  })

  it('reminds only once the last export is a week old', () => {
    expect(shouldRemindBackup(daysAgo(6.9), 50, NOW)).toBe(false)
    expect(shouldRemindBackup(daysAgo(7), 50, NOW)).toBe(true)
  })
})
