import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'

/**
 * Re-runs `query` whenever the IndexedDB data it read changes (Dexie
 * liveQuery). Returns undefined until the first result arrives. A tiny
 * stand-in for dexie-react-hooks, so no extra dependency.
 */
export function useLiveQuery<T>(query: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const [result, setResult] = useState<{ value: T } | undefined>(undefined)
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (value) => setResult({ value }),
      error: (error: unknown) => console.error('useLiveQuery:', error),
    })
    return () => subscription.unsubscribe()
    // The caller owns the dependency list, like useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return result?.value
}
