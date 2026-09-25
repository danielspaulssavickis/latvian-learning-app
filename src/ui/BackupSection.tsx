import { useRef, useState } from 'react'
import { exportProgress, importProgress } from '../db/backup'
import { useApp } from './appContext'

/** Export / import of all progress as one JSON file (ADR-002, ADR-013). */
export function BackupSection() {
  const { db, clock, resync } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  async function onExport() {
    const now = clock()
    const json = await exportProgress(db, now)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `latvian-trainer-progress-${now.toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage({ tone: 'ok', text: 'Backup downloaded.' })
  }

  async function onImport(file: File) {
    const ok = window.confirm(
      'Importing replaces ALL progress in this browser with the backup. Continue?',
    )
    if (!ok) return
    try {
      const counts = await importProgress(db, await file.text())
      await resync()
      setMessage({
        tone: 'ok',
        text: `Imported ${counts.cards} cards and ${counts.reviews} reviews.`,
      })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Backup</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Progress is stored only in this browser. Export it now and then; import it on a new device
        or after clearing browser data.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onExport}
          className="rounded-md bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900"
        >
          Export progress
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          Import progress…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Progress backup file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void onImport(file)
          }}
        />
      </div>
      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={
            message.tone === 'error' ? 'text-sm text-rose-700' : 'text-sm text-emerald-700'
          }
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
