import { diacriticDiff, type CheckOptions } from '../engine/checkAnswer'
import type { Answer } from '../engine/reviewSession'

/** The result line under an answered card: correct / near miss with the diacritic diff / wrong. */
export function Feedback({ answer, options }: { answer: Answer; options?: CheckOptions }) {
  // The learner wrote an accepted alternative: say so, and show the main wording too (ADR-016).
  const viaAlternative = answer.matched !== undefined
  if (answer.result === 'correct') {
    return (
      <div role="status" className="space-y-1">
        <p className="font-medium text-emerald-700 dark:text-emerald-400">Correct.</p>
        {viaAlternative && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Another way to say it: {answer.expected}
          </p>
        )}
      </div>
    )
  }
  if (answer.result === 'nearMiss') {
    const target = answer.matched ?? answer.expected
    const diff = diacriticDiff(answer.expected, answer.given, options) ?? []
    return (
      <div role="status" className="space-y-1">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          Almost — right words, check the diacritics:
        </p>
        <p className="text-2xl" aria-label={`Correct spelling: ${target}`}>
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
      {answer.confusedWith && (
        <p className="text-slate-700 dark:text-slate-200">
          <strong lang="lv">{answer.given}</strong> is a real form of this word — the{' '}
          {answer.confusedWith} — but not the form asked for here.
        </p>
      )}
      {options?.alternatives && options.alternatives.length > 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Also accepted: {options.alternatives.join(' · ')}
        </p>
      )}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        You typed: {answer.given} · this card comes back at the end of the session.
      </p>
    </div>
  )
}
