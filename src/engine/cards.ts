import type { Features, Lexeme, Sentence } from '../content/schemas'
import { inflect, type Grammar } from './inflect'

/**
 * What a card *is*, derived from content alone. Scheduling state is added on
 * top in src/db/ — this part must be reproducible from content at any time.
 */
export type CardKind = 'recognize' | 'cloze' | 'inflect' | 'produce'

export interface CardSpec {
  /** `${kind}:${targetId}` — stable across regenerations (ADR-009, ADR-012). */
  id: string
  kind: CardKind
  /**
   * cloze: `${sentenceId}#${tokenIndex}`; recognize/produce: the sentence id;
   * inflect: `${lexemeId}@${formKey}`, e.g. "lex_maja@loc.sg".
   */
  targetId: string
  /** The sentence this card comes from (for inflect: the first one using that form). */
  sentenceId: string
  /** The token drilled; null for whole-sentence cards (recognize, produce). */
  tokenIndex: number | null
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

/**
 * Within one sentence, new cards come easiest first: understand it
 * (recognize), fill one form in context (cloze), produce the form bare
 * (inflect), then write the whole sentence (produce).
 */
const KIND_ORDER: Record<CardKind, number> = { recognize: 0, cloze: 1, inflect: 2, produce: 3 }

/**
 * Content order: by sentence id, then kind (KIND_ORDER), then token position.
 * New cards are introduced in this order.
 */
export function compareContentOrder(
  a: Pick<CardSpec, 'sentenceId' | 'tokenIndex' | 'kind'>,
  b: Pick<CardSpec, 'sentenceId' | 'tokenIndex' | 'kind'>,
): number {
  if (a.sentenceId !== b.sentenceId) return a.sentenceId < b.sentenceId ? -1 : 1
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.tokenIndex ?? -1) - (b.tokenIndex ?? -1)
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

function fold(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase('lv')
}

/**
 * Every card the content supports (ADR-012), in content order:
 *
 * - `cloze` — one per drillable token (see `generateCards`);
 * - `recognize` and `produce` — one each per sentence;
 * - `inflect` — one per distinct (lexeme, case.number) among drillable noun
 *   and pronoun tokens, and only where `inflect()` reproduces the sentence's
 *   own surface form. The answer is therefore vouched for by an approved
 *   sentence even while the grammar tables are drafts (ADR-008's rule is
 *   about forms no reviewed sentence backs).
 */
export function generateAllCards(
  sentences: readonly Sentence[],
  lexemeById: ReadonlyMap<string, Lexeme>,
  grammar: Grammar,
): CardSpec[] {
  const cards = generateCards(sentences, lexemeById)
  const inflectIds = new Set<string>()

  for (const sentence of [...sentences].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    for (const kind of ['recognize', 'produce'] as const) {
      cards.push({
        id: `${kind}:${sentence.id}`,
        kind,
        targetId: sentence.id,
        sentenceId: sentence.id,
        tokenIndex: null,
        feature: `skill:${kind}`,
        features: [`skill:${kind}`],
      })
    }

    sentence.tokens.forEach((token, tokenIndex) => {
      const lexeme = lexemeById.get(token.lexeme)
      const { case: grammaticalCase, number } = token.features
      if (!token.drillable || !lexeme || !grammaticalCase || !number) return
      const result = inflect(lexeme, { case: grammaticalCase, number }, grammar)
      if (!result.ok || fold(result.form) !== fold(token.surface)) return
      const targetId = `${lexeme.id}@${grammaticalCase}.${number}`
      if (inflectIds.has(targetId)) return
      inflectIds.add(targetId)
      cards.push({
        id: `inflect:${targetId}`,
        kind: 'inflect',
        targetId,
        sentenceId: sentence.id,
        tokenIndex,
        feature: `case:${grammaticalCase}`,
        features: featureList({ case: grammaticalCase, number }, lexeme),
      })
    })
  }

  return cards.sort(compareContentOrder)
}
