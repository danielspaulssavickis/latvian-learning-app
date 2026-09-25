import { diacriticDiff, type CheckOptions } from '../engine/checkAnswer'
import type { Answer } from '../engine/reviewSession'

/** The result line under an answered card: correct / near miss with the diacritic diff / wrong. */
export function Feedback({ answer, options }: { answer: Answer; options?: CheckOptions }) {
  if (answer.result === 'correct') {
    return (
      <p role="status" className="font-medium text-emerald-700 dark:text-emerald-400">
        Correct.
      </p>
    )
  }
  if (answer.result === 'nearMiss') {
    const diff = diacriticDiff(answer.expected, answer.given, options) ?? []
    return (
      <div role="status" className="space-y-1">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          Almost — right words, check the diacritics:
        </p>
        <p className="text-2xl" aria-label={`Correct spelling: ${answer.expected}`}>
          {diff.map((segment, index) =>
            segment.differs ? (
              <mark
                key={index}
                className="rounded bg-amber-200 px-0.5 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200"
              >
                {segment.text}
              </mark>
            ) : (
              <span key={index}>{segment.text}</span>
            ),
          )}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">You typed: {answer.given}</p>
      </div>
    )
  }
  return (
    <div role="status" className="space-y-1">
      <p className="font-medium text-rose-700 dark:text-rose-400">
        Not quite. The answer is <strong className="text-xl">{answer.expected}</strong>.
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        You typed: {answer.given} · this card comes back at the end of the session.
      </p>
    </div>
  )
}
