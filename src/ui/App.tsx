import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LoadedContent } from '../content/loader'
import { syncCards } from '../db/cards'
import type { TrainerDb } from '../db/db'
import { generateAllCards } from '../engine/cards'
import { createScheduler, type Clock } from '../engine/schedule'
import { AppContext, type AppServices } from './appContext'
import { ProgressScreen } from './ProgressScreen'
import { ReviewScreen } from './ReviewScreen'
import { SettingsScreen } from './SettingsScreen'

type Tab = 'review' | 'progress' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'review', label: 'Review' },
  { id: 'progress', label: 'Progress' },
  { id: 'settings', label: 'Settings' },
]

interface Props {
  content: LoadedContent
  db: TrainerDb
  clock: Clock
  preview?: boolean
}

export function App({ content, db, clock, preview = false }: Props) {
  const scheduler = useMemo(() => createScheduler(clock), [clock])
  // Bring stored cards in line with the loaded content (ADR-009, ADR-012).
  const resync = useCallback(async () => {
    const specs = generateAllCards(
      [...content.sentenceById.values()],
      content.lexemeById,
      content.grammar,
    )
    await syncCards(db, specs, scheduler)
  }, [content, db, scheduler])
  const services = useMemo<AppServices>(
    () => ({ content, db, clock, scheduler, preview, resync }),
    [content, db, clock, scheduler, preview, resync],
  )
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('review')

  // Sync before any screen reads the cards.
  useEffect(() => {
    resync().then(
      () => setReady(true),
      (cause: unknown) => setError(`Could not open your progress database: ${String(cause)}`),
    )
  }, [resync])

  return (
    <AppContext.Provider value={services}>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        {preview && (
          <div
            role="note"
            className="bg-amber-400 px-4 py-1.5 text-center text-sm font-medium text-amber-950"
          >
            Draft preview — unreviewed content, separate progress. Not for real study (ADR-011).
          </div>
        )}
        <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
            <h1 className="text-lg font-semibold">Latvian Trainer</h1>
            <nav aria-label="Main">
              <ul className="flex gap-1">
                {TABS.map(({ id, label }) => (
                  <li key={id}>
                    <button
                      type="button"
                      aria-current={tab === id ? 'page' : undefined}
                      onClick={() => setTab(id)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                        tab === id
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-8">
          {error ? (
            <p role="alert" className="rounded-md bg-rose-50 p-4 text-rose-800">
              {error}
            </p>
          ) : !ready ? (
            <p className="text-slate-500">Loading…</p>
          ) : tab === 'review' ? (
            <ReviewScreen />
          ) : tab === 'progress' ? (
            <ProgressScreen />
          ) : (
            <SettingsScreen />
          )}
        </main>
      </div>
    </AppContext.Provider>
  )
}
