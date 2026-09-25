import type { Features, Lexeme, Sentence } from '../content/schemas'

/**
 * What a card *is*, derived from content alone. Scheduling state is added on
 * top in src/db/ — this part must be reproducible from content at any time.
 */
export interface CardSpec {
  /** `${kind}:${targetId}` — stable across regenerations (ADR-009). */
  id: string
  kind: 'cloze'
  /** `${sentenceId}#${tokenIndex}` */
  targetId: string
  sentenceId: string
  tokenIndex: number
  /** The feature this card drills, e.g. "case:loc" — see `primaryFeature`. */
  feature: string
  /**
   * Every feature the answer exercises: the token's features plus the
   * lexeme's declension or conjugation class. Per-feature progress (M4)
   * credits all of them, not just `feature`.
   */
  features: string[]
}

/** Most specific first: the debitive is the point of a debitive sentence, etc. */
const FEATURE_PRIORITY = [
  'mood',
  'case',
  'tense',
  'person',
  'number',
  'gender',
  'definiteness',
] as const

export function primaryFeature(features: Features): string {
  for (const key of FEATURE_PRIORITY) {
    const value = features[key]
    if (value !== undefined) return `${key}:${value}`
  }
  throw new Error('a drillable token must have at least one feature')
}

function featureList(features: Features, lexeme: Lexeme): string[] {
  const list = FEATURE_PRIORITY.filter((key) => features[key] !== undefined).map(
    (key) => `${key}:${features[key]}`,
  )
  if (lexeme.declension !== null) list.push(`declension:${lexeme.declension}`)
  if (lexeme.conjugation !== null) list.push(`conjugation:${lexeme.conjugation}`)
  return list
}

/** Content order: by sentence id, then token position. New cards are introduced in this order. */
export function compareContentOrder(
  a: Pick<CardSpec, 'sentenceId' | 'tokenIndex'>,
  b: Pick<CardSpec, 'sentenceId' | 'tokenIndex'>,
): number {
  if (a.sentenceId !== b.sentenceId) return a.sentenceId < b.sentenceId ? -1 : 1
  return a.tokenIndex - b.tokenIndex
}

/**
 * One cloze card per drillable token (ADR-009). Pure and deterministic: the
 * same content always yields the same cards with the same ids, in content
 * order, whatever order the sentences arrive in — so adding content can
 * only add cards, never rename existing ones.
 *
 * The cloze answer is the approved sentence's own surface form, never
 * `inflect()` output, so ADR-008's unverified-form rule can't be broken here.
 */
export function generateCards(
  sentences: readonly Sentence[],
  lexemeById: ReadonlyMap<string, Lexeme>,
): CardSpec[] {
  const cards: CardSpec[] = []
  for (const sentence of sentences) {
    sentence.tokens.forEach((token, tokenIndex) => {
      if (!token.drillable) return
      const lexeme = lexemeById.get(token.lexeme)
      if (!lexeme) {
        throw new Error(`${sentence.id} token ${tokenIndex}: unknown lexeme ${token.lexeme}`)
      }
      const targetId = `${sentence.id}#${tokenIndex}`
      cards.push({
        id: `cloze:${targetId}`,
        kind: 'cloze',
        targetId,
        sentenceId: sentence.id,
        tokenIndex,
        feature: primaryFeature(token.features),
        features: featureList(token.features, lexeme),
      })
    })
  }
  return cards.sort(compareContentOrder)
}
