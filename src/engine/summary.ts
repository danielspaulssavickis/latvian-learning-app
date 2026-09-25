import type { Answer } from './reviewSession'

export interface FeatureSummary {
  feature: string
  total: number
  wrong: number
  nearMiss: number
}

export interface SessionSummary {
  count: number
  correct: number
  nearMiss: number
  wrong: number
  /** Share of first attempts accepted (correct or near miss). */
  accuracy: number
  /** Worst first: by share wrong, then share near-missed, then name. */
  byFeature: FeatureSummary[]
}

/** The end-of-session summary. Only first attempts count — repeats would flatter the numbers. */
export function summarize(answers: readonly Answer[]): SessionSummary {
  const first = answers.filter((a) => a.firstAttempt)
  const count = first.length
  const correct = first.filter((a) => a.result === 'correct').length
  const nearMiss = first.filter((a) => a.result === 'nearMiss').length
  const wrong = count - correct - nearMiss

  const features = new Map<string, FeatureSummary>()
  for (const a of first) {
    const entry = features.get(a.feature) ?? { feature: a.feature, total: 0, wrong: 0, nearMiss: 0 }
    entry.total += 1
    if (a.result === 'wrong') entry.wrong += 1
    if (a.result === 'nearMiss') entry.nearMiss += 1
    features.set(a.feature, entry)
  }
  const byFeature = [...features.values()].sort(
    (a, b) =>
      b.wrong / b.total - a.wrong / a.total ||
      b.nearMiss / b.total - a.nearMiss / a.total ||
      a.feature.localeCompare(b.feature),
  )

  return {
    count,
    correct,
    nearMiss,
    wrong,
    accuracy: count === 0 ? 0 : (correct + nearMiss) / count,
    byFeature,
  }
}
