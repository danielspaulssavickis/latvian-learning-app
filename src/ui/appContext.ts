import { createContext, useContext } from 'react'
import type { LoadedContent } from '../content/loader'
import type { TrainerDb } from '../db/db'
import type { Clock, Scheduler } from '../engine/schedule'

/** Everything a screen needs, injected once at the top so tests can swap it all. */
export interface AppServices {
  content: LoadedContent
  db: TrainerDb
  clock: Clock
  scheduler: Scheduler
  /** Running on draft content (ADR-011). */
  preview: boolean
  /** Re-sync stored cards with the content, e.g. after importing a backup. */
  resync: () => Promise<void>
}

export const AppContext = createContext<AppServices | null>(null)

export function useApp(): AppServices {
  const services = useContext(AppContext)
  if (!services) throw new Error('useApp() outside <AppContext.Provider>')
  return services
}
