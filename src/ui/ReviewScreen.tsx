import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { loadSession, recordReview } from '../db/cards'
import { getSettings } from '../db/settings'
import { buildExercise, type Exercise } from '../engine/exercise'
import { initialReviewState, reviewReducer } from '../engine/reviewSession'
import { startOfLocalDay } from '../engine/session'
import { summarize } from '../engine/summary'
import { useApp } from './appContext'
import { BackupReminder } from './BackupReminder'
import { CardView } from './CardView'
import { SessionSummary } from './SessionSummary'
import { useLiveQuery } from './useLiveQuery'

/**
 * The review loop. All decisions live in src/engine (reviewReducer,
 * checkAnswer, selectSession) and src/db (loadSession, recordReview); this
 * component renders state and dispatches actions with the current time.
 */
export function ReviewScreen() {
  const { db, content, clock, scheduler } = useApp()
  const [state, dispatch] = useReducer(reviewReducer, initialReviewState)
  const [error, setError] = useState<string | null>(null)

  // Re-plan once a minute while idle, so cards that fall due show up
  // without a reload (the live query itself only reruns on database writes).
  const [minute, setMinute] = useState(0)
  useEffect(() => {
    if (state.phase !== 'idle') return
    const timer = window.setInterval(() => setMinute((m) => m + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [state.phase])

  const plan = useLiveQuery(async () => {
    const now = clock()
    const settings = await getSettings(db)
    return loadSession(db, now, settings.dailyLimits, startOfLocalDay(now))
  }, [db, clock, minute])

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

  const submit = useCallback(
    (given: string) => dispatch({ type: 'submit', given, now: clock() }),
    [clock],
  )
  const next = useCallback(() => dispatch({ type: 'next', now: clock() }), [clock])

  function start() {
    if (!plan) return
    const exercises = [...plan.reviews, ...plan.newCards]
      .map((card) => buildExercise(card, content))
      .filter((exercise): exercise is Exercise => exercise !== null)
    dispatch({ type: 'start', exercises, now: clock() })
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
        ) : content.sentenceById.size === 0 ? (
          <p className="text-slate-600 dark:text-slate-300">
            No study material yet. Sentences appear here once they are approved — see{' '}
            <code>content/README.md</code> for the review workflow.
          </p>
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
        <BackupReminder />
      </section>
    )
  }

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
      <CardView
        // A fresh CardView per showing, so the typed draft never carries over.
        key={state.shown}
        exercise={state.current}
        answer={answered}
        onSubmit={submit}
        onNext={next}
      />
    </section>
  )
}
