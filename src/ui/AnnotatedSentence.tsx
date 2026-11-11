import type { ReactNode } from 'react'
import { wordClassOf, type SentenceWord } from '../engine/wordClasses'
import { POS_STYLE } from './posStyle'

interface Props {
  words: SentenceWord[]
  /** Show the coloured line and class label under each word. */
  showClasses: boolean
  /** Replace one token (the cloze blank) with something else; it still gets its label. */
  renderToken?: (tokenIndex: number) => ReactNode
  className?: string
}

/**
 * A Latvian sentence rendered word by word. With `showClasses` on, each word
 * sits on a coloured line with its part of speech underneath — the legend
 * the learner can switch on from any card.
 */
export function AnnotatedSentence({ words, showClasses, renderToken, className = '' }: Props) {
  return (
    <span lang="lv" className={className}>
      {words.map((word, index) => {
        if (word.tokenIndex === null) return <span key={index}>{word.text}</span>
        const content = renderToken?.(word.tokenIndex) ?? word.text
        if (!showClasses || !word.pos) return <span key={index}>{content}</span>
        const style = POS_STYLE[word.pos]
        const wordClass = wordClassOf(word.pos)
        return (
          <span key={index} className="inline-flex flex-col items-center align-top">
            <span className={`border-b-[3px] ${style.line}`}>{content}</span>
            <span
              className={`mt-0.5 text-[0.6rem] font-medium uppercase leading-none tracking-wide ${style.label}`}
              lang="en"
              aria-label={`${word.text}: ${wordClass.english}`}
            >
              {wordClass.short}
            </span>
          </span>
        )
      })}
    </span>
  )
}

/** The small "Aa" toggle at the right of a sentence. */
export function WordClassToggle({ pressed, onToggle }: { pressed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label="Word classes"
      title={pressed ? 'Hide word classes' : 'Show word classes'}
      onClick={onToggle}
      className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${
        pressed
          ? 'border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900'
          : 'border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'
      }`}
    >
      <span aria-hidden="true" className="underline decoration-emerald-500 decoration-2">
        Aa
      </span>
    </button>
  )
}
