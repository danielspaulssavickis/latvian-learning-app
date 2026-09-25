import type { CheckResult } from './checkAnswer'

/** The slice of a review log entry retention needs. */
export interface ReviewFact {
  features: readonly string[]
  result: CheckResult
  reviewedAt: Date
}

export interface FeatureRetention {
  feature: string
  /** Reviews in the window (≤ window size). */
  count: number
  /** Of those, answered correctly or as a near miss. */
  retained: number
  retention: number
  /** Consecutive wrong answers ending with the most recent review. */
  wrongStreak: number
  /** Too few reviews for the number to mean much. */
  lowData: boolean
}

export const RETENTION_WINDOW = 30
export const LOW_DATA_BELOW = 5

/**
 * Per-feature retention over each feature's trailing `window` reviews
 * (SPEC.md progress model). A near miss counts as retained — it's graded
 * hard, not a lapse. Sorted worst-first: lowest retention, then the longest
 * current wrong streak, then name — so a feature failed ten times running
 * sorts above one failed ten times long ago. Pure; the caller passes the
 * review log.
 */
export function featureRetention(
  facts: readonly ReviewFact[],
  { window = RETENTION_WINDOW }: { window?: number } = {},
): FeatureRetention[] {
  const newestFirst = [...facts].sort((a, b) => b.reviewedAt.getTime() - a.reviewedAt.getTime())
  const byFeature = new Map<string, CheckResult[]>()
  for (const fact of newestFirst) {
    for (const feature of fact.features) {
      const results = byFeature.get(feature) ?? []
      if (results.length < window) results.push(fact.result)
      byFeature.set(feature, results)
    }
  }

  const rows: FeatureRetention[] = []
  for (const [feature, results] of byFeature) {
    const retained = results.filter((r) => r !== 'wrong').length
    const streakEnd = results.findIndex((r) => r !== 'wrong')
    rows.push({
      feature,
      count: results.length,
      retained,
      retention: retained / results.length,
      wrongStreak: streakEnd === -1 ? results.length : streakEnd,
      lowData: results.length < LOW_DATA_BELOW,
    })
  }
  return rows.sort(
    (a, b) =>
      a.retention - b.retention ||
      b.wrongStreak - a.wrongStreak ||
      a.feature.localeCompare(b.feature),
  )
}
