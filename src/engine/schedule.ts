import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type FSRSParameters,
  type Grade as FsrsGrade,
  type ReviewLog,
} from 'ts-fsrs'
import type { CheckResult } from './checkAnswer'

/**
 * The scheduling seam (ADR-003): everything outside this file talks in these
 * types, so replacing ts-fsrs means replacing this module, not its callers.
 * `SchedulingState` is stored as-is in IndexedDB (plain data + Dates).
 */
export type SchedulingState = Card
export type SchedulingLog = ReviewLog
export type Grade = 'again' | 'hard' | 'good' | 'easy'

/** Injected everywhere a time is needed — the engine never reads the system clock. */
export type Clock = () => Date

export interface GradeThresholds {
  /** A correct answer strictly faster than this is `easy`. */
  easyUnderMs: number
  /** A correct answer strictly slower than this is `hard`. */
  hardOverMs: number
}

/**
 * First guesses, to be tuned against real review logs. Response time runs
 * from the prompt appearing to Enter, so it includes reading the sentence
 * and typing diacritics — hence generous numbers.
 */
export const DEFAULT_GRADE_THRESHOLDS: GradeThresholds = { easyUnderMs: 5_000, hardOverMs: 20_000 }

/**
 * Check result + response time → FSRS grade:
 *
 * | result     | response time                  | grade   |
 * |------------|--------------------------------|---------|
 * | `wrong`    | any                            | `again` |
 * | `nearMiss` | any                            | `hard`  |
 * | `correct`  | < easyUnderMs                  | `easy`  |
 * | `correct`  | easyUnderMs ..= hardOverMs     | `good`  |
 * | `correct`  | > hardOverMs                   | `hard`  |
 *
 * A near miss is `hard`, not a failure (SPEC.md): the form was right, only
 * the diacritic slipped. Time never upgrades a near miss or a wrong answer.
 */
export function gradeFor(
  result: CheckResult,
  responseMs: number,
  thresholds: GradeThresholds = DEFAULT_GRADE_THRESHOLDS,
): Grade {
  if (result === 'wrong') return 'again'
  if (result === 'nearMiss') return 'hard'
  if (responseMs < thresholds.easyUnderMs) return 'easy'
  if (responseMs > thresholds.hardOverMs) return 'hard'
  return 'good'
}

const RATING: Record<Grade, FsrsGrade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

export function isNew(state: SchedulingState): boolean {
  return state.state === State.New
}

export interface Scheduler {
  newCard(): SchedulingState
  review(card: SchedulingState, grade: Grade): { card: SchedulingState; log: SchedulingLog }
}

/**
 * Wraps ts-fsrs with an injected clock. Fuzz is off so that the same card,
 * time and grade always give the same result — scheduling is testable
 * against fixed clock values (SPEC.md).
 */
export function createScheduler(clock: Clock, params: Partial<FSRSParameters> = {}): Scheduler {
  const f = fsrs({ enable_fuzz: false, ...params })
  return {
    newCard: () => createEmptyCard(clock()),
    review: (card, grade) => f.next(card, clock(), RATING[grade]),
  }
}
