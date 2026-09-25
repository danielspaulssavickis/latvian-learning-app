import { describe, expect, it } from 'vitest'
import type { ClozeExercise } from './exercise'
import { initialReviewState, reviewReducer, type ReviewState } from './reviewSession'

const T0 = new Date('2026-09-25T09:00:00.000Z')
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000)

function cloze(id: string, expected: string): ClozeExercise {
  return {
    kind: 'cloze',
    cardId: id,
    feature: 'case:loc',
    before: '',
    after: '.',
    lemma: 'x',
    gloss: 'x',
    expected,
  }
}

function started(): ReviewState {
  return reviewReducer(initialReviewState, {
    type: 'start',
    exercises: [cloze('a', 'Rīgā'), cloze('b', 'mājā')],
    now: T0,
  })
}

describe('reviewReducer', () => {
  it('starts answering the first exercise', () => {
    const state = started()
    expect(state.phase).toBe('answering')
    expect(state.current?.cardId).toBe('a')
  })

  it('goes straight to done on an empty queue', () => {
    const state = reviewReducer(initialReviewState, { type: 'start', exercises: [], now: T0 })
    expect(state.phase).toBe('done')
  })

  it('checks the answer and times it from when the exercise was shown', () => {
    const state = reviewReducer(started(), { type: 'submit', given: 'Riga', now: at(7) })
    expect(state.phase).toBe('feedback')
    expect(state.lastAnswer).toEqual({
      cardId: 'a',
      feature: 'case:loc',
      expected: 'Rīgā',
      given: 'Riga',
      result: 'nearMiss',
      responseMs: 7000,
      firstAttempt: true,
    })
  })

  it('ignores an empty submission', () => {
    const state = reviewReducer(started(), { type: 'submit', given: '   ', now: at(1) })
    expect(state.phase).toBe('answering')
  })

  it('advances to the next exercise and restarts the timer', () => {
    let state = reviewReducer(started(), { type: 'submit', given: 'Rīgā', now: at(3) })
    state = reviewReducer(state, { type: 'next', now: at(10) })
    expect(state.current?.cardId).toBe('b')
    state = reviewReducer(state, { type: 'submit', given: 'mājā', now: at(12) })
    expect(state.lastAnswer?.responseMs).toBe(2000)
  })

  it('re-queues a wrong answer at the end, as a repeat', () => {
    let state = reviewReducer(started(), { type: 'submit', given: 'Rīgu', now: at(3) })
    expect(state.lastAnswer?.result).toBe('wrong')
    state = reviewReducer(state, { type: 'next', now: at(4) })
    expect(state.current?.cardId).toBe('b')
    state = reviewReducer(state, { type: 'submit', given: 'mājā', now: at(5) })
    state = reviewReducer(state, { type: 'next', now: at(6) })
    expect(state.current?.cardId).toBe('a')
    state = reviewReducer(state, { type: 'submit', given: 'Rīgā', now: at(8) })
    expect(state.lastAnswer?.firstAttempt).toBe(false)
    state = reviewReducer(state, { type: 'next', now: at(9) })
    expect(state.phase).toBe('done')
    expect(state.answers.map((a) => [a.cardId, a.result])).toEqual([
      ['a', 'wrong'],
      ['b', 'correct'],
      ['a', 'correct'],
    ])
  })

  it('ignores submit during feedback and next during answering', () => {
    const answering = started()
    expect(reviewReducer(answering, { type: 'next', now: at(1) })).toBe(answering)
    const feedback = reviewReducer(answering, { type: 'submit', given: 'Rīgā', now: at(1) })
    expect(reviewReducer(feedback, { type: 'submit', given: 'x', now: at(2) })).toBe(feedback)
  })

  it('can be ended early, then reset to idle', () => {
    const state = reviewReducer(started(), { type: 'finish' })
    expect(state.phase).toBe('done')
    expect(reviewReducer(state, { type: 'reset' })).toEqual(initialReviewState)
  })
})
