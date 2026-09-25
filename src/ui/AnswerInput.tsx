import type { RefObject } from 'react'

interface Props {
  inputRef: RefObject<HTMLInputElement | null>
  label: string
  value: string
  onChange: (value: string) => void
  /** Inline sits inside a sentence (cloze); block is a full-width field. */
  variant: 'inline' | 'block'
}

/** The typed-answer field: Latvian input, no autocorrect or autocapitalize to "help". */
export function AnswerInput({ inputRef, label, value, onChange, variant }: Props) {
  return (
    <input
      ref={inputRef}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      lang="lv"
      size={variant === 'inline' ? Math.max(8, value.length + 1) : undefined}
      className={
        variant === 'inline'
          ? 'mx-1 rounded-md border-b-2 border-emerald-600 bg-emerald-50 px-2 py-0.5 text-center text-2xl outline-none focus:bg-emerald-100 sm:text-3xl dark:bg-emerald-950 dark:focus:bg-emerald-900'
          : 'w-full rounded-md border-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-xl outline-none focus:bg-emerald-100 dark:bg-emerald-950 dark:focus:bg-emerald-900'
      }
    />
  )
}
