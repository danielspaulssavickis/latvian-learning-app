import type { RefObject } from 'react'
import { insertAt, LATVIAN_LETTERS } from './diacritics'

interface Props {
  inputRef: RefObject<HTMLInputElement | null>
  value: string
  onChange: (value: string, caret: number) => void
  disabled?: boolean
}

/**
 * Clickable ā ē ī ū č ģ ķ ļ ņ š ž. Inserting never steals focus from the
 * answer input: mousedown is cancelled, so the caret stays where it was.
 */
export function DiacriticRow({ inputRef, value, onChange, disabled }: Props) {
  function insert(letter: string) {
    const input = inputRef.current
    const start = input?.selectionStart ?? value.length
    const end = input?.selectionEnd ?? value.length
    const next = insertAt(value, start, end, letter)
    onChange(next.value, next.caret)
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Latvian letters">
        {LATVIAN_LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insert(letter)}
            className="h-10 w-10 rounded-md border border-slate-300 bg-white text-lg font-medium text-slate-800 shadow-sm hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            {letter}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Tip: with the “Latvian (apostrophe)” keyboard layout, type{' '}
        <kbd className="rounded border px-1">'</kbd> then a letter — <kbd>'a</kbd> → ā,{' '}
        <kbd>'s</kbd> → š, <kbd>'k</kbd> → ķ.
      </p>
    </div>
  )
}
