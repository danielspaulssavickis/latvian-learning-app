import { isNew } from './schedule'
import type { StoredCard } from './session'

export interface CardStats {
  /** Active (not retired) cards. */
  total: number
  /** Active cards reviewed at least once. */
  seen: number
  /** Seen cards due now or overdue. */
  dueNow: number
}

/** Headline counts for the progress screen. Pure; `now` is passed in. */
export function cardStats(cards: readonly StoredCard[], now: Date): CardStats {
  const active = cards.filter((card) => !card.retired)
  const seen = active.filter((card) => !isNew(card.fsrs))
  return {
    total: active.length,
    seen: seen.length,
    dueNow: seen.filter((card) => card.fsrs.due.getTime() <= now.getTime()).length,
  }
}

/** Grammar features (case, number, declension, …) vs skills (recognize, produce, …). */
export function isSkill(feature: string): boolean {
  return feature.startsWith('skill:')
}
