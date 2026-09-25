import { checkAnswer, type CheckResult } from './checkAnswer'
import type { Exercise } from './exercise'

export interface Answer {
  cardId: string
  feature: string
  expected: string
  given: string
  result: CheckResult
  responseMs: number
  /** False for a re-queued repeat of a card answered wrong earlier this session. */
  firstAttempt: boolean
}

export interface ReviewState {
  phase: 'idle' | 'answering' | 'feedback' | 'done'
  queue: Exercise[]
  current: Exercise | null
  /** Card ids already attempted this session — a later attempt is a repeat. */
  attempted: string[]
  shownAt: Date | null
  lastAnswer: Answer | null
  answers: Answer[]
}

export type ReviewAction =
  | { type: 'start'; exercises: Exercise[]; now: Date }
  | { type: 'submit'; given: string; now: Date }
  | { type: 'next'; now: Date }
  | { type: 'finish' }
  | { type: 'reset' }

export const initialReviewState: ReviewState = {
  phase: 'idle',
  queue: [],
  current: null,
  attempted: [],
  shownAt: null,
  lastAnswer: null,
  answers: [],
}

function show(state: ReviewState, queue: Exercise[], now: Date): ReviewState {
  const [current, ...rest] = queue
  if (!current) return { ...state, phase: 'done', queue: [], current: null, shownAt: null }
  return { ...state, phase: 'answering', queue: rest, current, shownAt: now }
}

/**
 * The review screen's state machine (keyboard flow: type, Enter submits,
 * Enter again advances). Pure — the component dispatches actions with the
 * current time and persists each `lastAnswer` via src/db/cards.ts. A wrong
 * answer re-queues the card at the end of the session; the repeat is
 * graded too but marked `firstAttempt: false` so the summary counts each
 * card once.
 */
export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case 'start':
      return show({ ...initialReviewState }, action.exercises, action.now)

    case 'submit': {
      if (state.phase !== 'answering' || !state.current || !state.shownAt) return state
      if (action.given.trim() === '') return state
      const exercise = state.current
      const result = checkAnswer(exercise.expected, action.given)
      const answer: Answer = {
        cardId: exercise.cardId,
        feature: exercise.feature,
        expected: exercise.expected,
        given: action.given,
        result,
        responseMs: action.now.getTime() - state.shownAt.getTime(),
        firstAttempt: !state.attempted.includes(exercise.cardId),
      }
      return {
        ...state,
        phase: 'feedback',
        attempted: [...state.attempted, exercise.cardId],
        lastAnswer: answer,
        answers: [...state.answers, answer],
        queue: result === 'wrong' ? [...state.queue, exercise] : state.queue,
      }
    }

    case 'next':
      if (state.phase !== 'feedback') return state
      return show(state, state.queue, action.now)

    case 'finish':
      return { ...state, phase: 'done', current: null, shownAt: null }

    case 'reset':
      return initialReviewState
  }
}
