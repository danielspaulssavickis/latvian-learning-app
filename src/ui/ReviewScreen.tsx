import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { loadSession, recordReview } from '../db/cards'
import { getSettings } from '../db/settings'
import { buildExercise, type Exercise } from '../engine/exercise'
import { initialReviewState, reviewReducer } from '../engine/reviewSession'
import { startOfLocalDay } from '../engine/session'
import { summarize } from '../engine/summary'
import { useApp } from './appContext'
import { DiacriticRow } from './DiacriticRow'
import { Feedback } from './Feedback'
import { SessionSummary } from './SessionSummary'
import { useLiveQuery } from './useLiveQuery'

const RESULT_COLOR = {
  correct: 'text-emerald-700 dark:text-emerald-400',
  nearMiss: 'text-amber-600 dark:text-amber-400',
  wrong: 'text-rose-700 dark:text-rose-400',
} as const

/**
 * The cloze review loop. Keyboard-first: type, Enter submits, Enter again
 * advances. All decisions live in src/engine (reviewReducer, checkAnswer,
 * selectSession) and src/db (loadSession, recordReview); this component
 * renders state and dispatches actions with the current time.
 */
export function ReviewScreen() {
  const { db, content, clock, scheduler } = useApp()
  const [state, dispatch] = useReducer(reviewReducer, initialReviewState)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const pendingCaret = useRef<number | null>(null)

  const plan = useLiveQuery(async () => {
    const now = clock()
    const settings = await getSettings(db)
    return loadSession(db, now, settings.dailyLimits, startOfLocalDay(now))
  }, [db, clock])

  // Persist each new answer, in order. The ref survives re-renders (and
  // StrictMode's double effects) so no answer is recorded twice.
  const persisted = useRef(0)
  const writes = useRef<Promise<unknown>>(Promise.resolve())
  useEffect(() => {
    if (state.answers.length < persisted.current) persisted.current = 0
    const pending = state.answers.slice(persisted.current)
    persisted.current = state.answers.length
    for (const answer of pending) {
      writes.current = writes.current.then(() =>
        recordReview(db, scheduler, {
          cardId: answer.cardId,
          result: answer.result,
          given: answer.given,
          responseMs: answer.responseMs,
        }).catch((cause: unknown) => setError(`Could not save your answer: ${String(cause)}`)),
      )
    }
  }, [state.answers, db, scheduler])

  // Focus follows the flow: the answer input while answering, Next during feedback.
  const shownAt = state.shownAt?.getTime()
  useEffect(() => {
    if (state.phase === 'answering') inputRef.current?.focus()
    if (state.phase === 'feedback') nextRef.current?.focus()
  }, [state.phase, shownAt])

  useLayoutEffect(() => {
    if (pendingCaret.current === null) return
    inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current)
    pendingCaret.current = null
  })

  function start() {
    if (!plan) return
    const exercises = [...plan.reviews, ...plan.newCards]
      .map((card) => buildExercise(card, content))
      .filter((exercise): exercise is Exercise => exercise !== null)
    setDraft('')
    dispatch({ type: 'start', exercises, now: clock() })
  }

  function submit() {
    dispatch({ type: 'submit', given: draft, now: clock() })
  }

  function next() {
    setDraft('')
    dispatch({ type: 'next', now: clock() })
  }

  if (error) {
    return (
      <p role="alert" className="rounded-md bg-rose-50 p-4 text-rose-800">
        {error}
      </p>
    )
  }

  if (state.phase === 'done') {
    return (
      <SessionSummary
        summary={summarize(state.answers)}
        onDone={() => dispatch({ type: 'reset' })}
      />
    )
  }

  if (state.phase === 'idle' || !state.current) {
    const reviews = plan?.reviews.length ?? 0
    const fresh = plan?.newCards.length ?? 0
    const empty = plan !== undefined && reviews + fresh === 0
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Review</h2>
        {plan === undefined ? (
          <p className="text-slate-500">Loading…</p>
        ) : empty ? (
          <p className="text-slate-600 dark:text-slate-300">
            Nothing due right now. Come back later — or raise the daily new-card limit in Settings.
          </p>
        ) : (
          <p className="text-slate-700 dark:text-slate-200">
            <strong>{reviews}</strong> review{reviews === 1 ? '' : 's'} due ·{' '}
            <strong>{fresh}</strong> new card{fresh === 1 ? '' : 's'}
          </p>
        )}
        <button
          type="button"
          autoFocus
          disabled={plan === undefined || empty}
          onClick={start}
          className="rounded-md bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800 disabled:bg-slate-300 dark:disabled:bg-slate-700"
        >
          Start session
        </button>
      </section>
    )
  }

  const exercise = state.current
  const answered = state.phase === 'feedback' ? state.lastAnswer : null
  const remaining = state.queue.length + (answered ? 0 : 1)

  return (
    <section aria-label="Review card" className="space-y-5">
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>{remaining} left</span>
        <button
          type="button"
          onClick={() => dispatch({ type: 'finish' })}
          className="underline-offset-2 hover:underline"
        >
          End session
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (answered) next()
          else submit()
        }}
      >
        <p className="text-2xl leading-relaxed sm:text-3xl" lang="lv">
          {exercise.before}
          {answered ? (
            <span className={`font-semibold ${RESULT_COLOR[answered.result]}`}>
              {answered.expected}
            </span>
          ) : (
            <input
              ref={inputRef}
              aria-label={`Answer: ${exercise.lemma}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              lang="lv"
              size={Math.max(8, draft.length + 1)}
              className="mx-1 rounded-md border-b-2 border-emerald-600 bg-emerald-50 px-2 py-0.5 text-center text-2xl outline-none focus:bg-emerald-100 sm:text-3xl dark:bg-emerald-950 dark:focus:bg-emerald-900"
            />
          )}
          {exercise.after}{' '}
          <span className="text-lg text-slate-500 dark:text-slate-400">({exercise.lemma})</span>
        </p>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{exercise.gloss}</p>

        <div className="mt-5">
          {answered ? (
            <div className="space-y-4">
              <Feedback answer={answered} />
              <button
                ref={nextRef}
                type="submit"
                className="rounded-md bg-slate-800 px-5 py-2.5 font-medium text-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900"
              >
                Next <span className="text-slate-400">(Enter)</span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="submit"
                className="rounded-md bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800"
              >
                Check <span className="text-emerald-200">(Enter)</span>
              </button>
              <DiacriticRow
                inputRef={inputRef}
                value={draft}
                onChange={(value, caret) => {
                  pendingCaret.current = caret
                  setDraft(value)
                }}
              />
            </>
          )}
        </div>
      </form>
    </section>
  )
}
