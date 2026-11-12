import { useEffect, useRef, useState } from 'react'
import { InflectionsScreen } from './InflectionsScreen'
import { WordClassesScreen } from './WordClassesScreen'

export type GrammarSubtab = 'word-classes' | 'inflections'

const SUBTABS: { id: GrammarSubtab; label: string }[] = [
  { id: 'word-classes', label: 'Word classes' },
  { id: 'inflections', label: 'Inflections' },
]

const STORAGE_KEY = 'grammar-subtab'

function remembered(): GrammarSubtab {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'inflections' ? 'inflections' : 'word-classes'
  } catch {
    return 'word-classes'
  }
}

/** The Grammar tab: two subtabs, the last one used remembered in this browser. */
export function GrammarScreen() {
  const [subtab, setSubtab] = useState<GrammarSubtab>(remembered)
  // An in-page target to scroll to once the other subtab has rendered.
  const target = useRef<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, subtab)
    } catch {
      // Storage blocked (private mode): just don't remember.
    }
  }, [subtab])

  useEffect(() => {
    if (!target.current) return
    document.getElementById(target.current)?.scrollIntoView?.({ block: 'start' })
    target.current = null
  }, [subtab])

  return (
    <div className="space-y-6">
      <nav aria-label="Grammar sections">
        <ul className="flex gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
          {SUBTABS.map(({ id, label }) => (
            <li key={id} className="flex-1">
              <button
                type="button"
                aria-current={subtab === id ? 'page' : undefined}
                onClick={() => setSubtab(id)}
                className={`w-full rounded-md px-3 py-1.5 text-sm font-medium ${
                  subtab === id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {subtab === 'word-classes' ? (
        <WordClassesScreen
          onShowPronounTables={() => {
            target.current = 'pronouns'
            setSubtab('inflections')
          }}
        />
      ) : (
        <InflectionsScreen />
      )}
    </div>
  )
}
