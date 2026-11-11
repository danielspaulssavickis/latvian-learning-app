import type { Pos } from '../engine/wordClasses'

/**
 * One colour per part of speech, as full class strings so Tailwind can see
 * them. `line` underlines the word, `chip` is the swatch on the legend.
 */
export const POS_STYLE: Record<Pos, { line: string; label: string; chip: string }> = {
  noun: {
    line: 'border-emerald-500',
    label: 'text-emerald-700 dark:text-emerald-400',
    chip: 'bg-emerald-500',
  },
  verb: { line: 'border-sky-500', label: 'text-sky-700 dark:text-sky-400', chip: 'bg-sky-500' },
  adjective: {
    line: 'border-violet-500',
    label: 'text-violet-700 dark:text-violet-400',
    chip: 'bg-violet-500',
  },
  pronoun: {
    line: 'border-amber-500',
    label: 'text-amber-700 dark:text-amber-400',
    chip: 'bg-amber-500',
  },
  adverb: {
    line: 'border-rose-500',
    label: 'text-rose-700 dark:text-rose-400',
    chip: 'bg-rose-500',
  },
  preposition: {
    line: 'border-teal-500',
    label: 'text-teal-700 dark:text-teal-400',
    chip: 'bg-teal-500',
  },
  conjunction: {
    line: 'border-indigo-500',
    label: 'text-indigo-700 dark:text-indigo-400',
    chip: 'bg-indigo-500',
  },
  particle: {
    line: 'border-fuchsia-500',
    label: 'text-fuchsia-700 dark:text-fuchsia-400',
    chip: 'bg-fuchsia-500',
  },
  numeral: {
    line: 'border-orange-500',
    label: 'text-orange-700 dark:text-orange-400',
    chip: 'bg-orange-500',
  },
  interjection: {
    line: 'border-lime-500',
    label: 'text-lime-700 dark:text-lime-400',
    chip: 'bg-lime-500',
  },
}
