import type { Lexeme, Sentence } from '../content/schemas'
import type { CardSpec } from './cards'

/** What the review screen needs to show one card — built from content, never stored. */
export interface ClozeExercise {
  kind: 'cloze'
  cardId: string
  feature: string
  /** Sentence text before and after the blank, punctuation included. */
  before: string
  after: string
  /** Shown in brackets after the blank. */
  lemma: string
  /** The English gloss of the whole sentence, as context. */
  gloss: string
  /** The approved sentence's own surface form — never inflect() output (ADR-008). */
  expected: string
}

export type Exercise = ClozeExercise

export interface ExerciseContent {
  sentenceById: ReadonlyMap<string, Sentence>
  lexemeById: ReadonlyMap<string, Lexeme>
}

/**
 * Locates token `index` in the sentence text by walking the tokens in order,
 * so a repeated surface form ("Es un es") resolves to the right occurrence.
 */
export function splitAroundToken(
  sentence: Sentence,
  index: number,
): { before: string; after: string } {
  let cursor = 0
  for (let i = 0; i <= index; i++) {
    const surface = sentence.tokens[i].surface
    const found = sentence.text.indexOf(surface, cursor)
    if (found < 0) {
      throw new Error(`${sentence.id}: token ${i} "${surface}" not found in its text in order`)
    }
    if (i === index) {
      return {
        before: sentence.text.slice(0, found),
        after: sentence.text.slice(found + surface.length),
      }
    }
    cursor = found + surface.length
  }
  throw new Error(`${sentence.id}: no token ${index}`)
}

/**
 * Builds the exercise for a card from the current content. Returns null if
 * the card's content is gone (a retired card that slipped through), so the
 * session can skip it instead of crashing.
 */
export function buildExercise(card: CardSpec, content: ExerciseContent): Exercise | null {
  const sentence = content.sentenceById.get(card.sentenceId)
  const token = sentence?.tokens[card.tokenIndex]
  const lexeme = token && content.lexemeById.get(token.lexeme)
  if (!sentence || !token || !lexeme) return null

  return {
    kind: 'cloze',
    cardId: card.id,
    feature: card.feature,
    ...splitAroundToken(sentence, card.tokenIndex),
    lemma: lexeme.lemma,
    gloss: sentence.gloss,
    expected: token.surface,
  }
}
