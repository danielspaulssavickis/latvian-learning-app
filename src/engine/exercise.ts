import type { Lexeme, Sentence } from '../content/schemas'
import type { CardSpec } from './cards'
import type { CheckOptions } from './checkAnswer'
import { inflect, type Grammar } from './inflect'
import { featureLabel } from './labels'

interface ExerciseBase {
  cardId: string
  feature: string
  /** What checkAnswer compares against. */
  expected: string
  /** How the answer is checked: one word, a whole sentence (punctuation ignored), or a choice. */
  check: 'word' | 'sentence' | 'choice'
  /** The sentence's recording, if it has one — playable after answering. */
  audio?: string
}

/** Sentence with one token blanked, lemma in brackets → typed form. */
export interface ClozeExercise extends ExerciseBase {
  kind: 'cloze'
  /** Sentence text before and after the blank, punctuation included. */
  before: string
  after: string
  lemma: string
  /** The English gloss of the whole sentence, as context. */
  gloss: string
}

/** Latvian sentence → pick the English gloss. */
export interface RecognizeExercise extends ExerciseBase {
  kind: 'recognize'
  text: string
  /** The correct gloss plus up to three others, in a stable shuffled order. */
  choices: string[]
}

/** English gloss → typed Latvian sentence. */
export interface ProduceExercise extends ExerciseBase {
  kind: 'produce'
  gloss: string
}

/**
 * Audio only → typed sentence. If the audio can't be played, the screen
 * falls back to `gloss` as a text prompt, so a missing file degrades to a
 * text-only card instead of breaking the session (M5).
 */
export interface ListenExercise extends ExerciseBase {
  kind: 'listen'
  audio: string
  gloss: string
}

/** Lemma + target features ("māja, locative singular") → typed form. */
export interface InflectExercise extends ExerciseBase {
  kind: 'inflect'
  lemma: string
  lemmaGloss: string
  /** e.g. "locative singular" */
  formLabel: string
}

export type Exercise =
  ClozeExercise | RecognizeExercise | ProduceExercise | ListenExercise | InflectExercise

export interface ExerciseContent {
  sentenceById: ReadonlyMap<string, Sentence>
  lexemeById: ReadonlyMap<string, Lexeme>
  grammar?: Grammar
}

export function checkOptionsFor(exercise: Exercise): CheckOptions {
  return { ignorePunctuation: exercise.check === 'sentence' }
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

/** FNV-1a: a small stable hash, so "random" choice order is the same every time for a card. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function stableShuffle<T>(items: readonly T[], seed: string, key: (item: T) => string): T[] {
  return [...items].sort((a, b) => hash(`${seed}|${key(a)}`) - hash(`${seed}|${key(b)}`))
}

const DISTRACTORS = 3

function recognizeChoices(cardId: string, sentence: Sentence, all: Iterable<Sentence>): string[] {
  const others = new Set<string>()
  for (const candidate of stableShuffle([...all], cardId, (s) => s.id)) {
    if (others.size >= DISTRACTORS) break
    if (candidate.gloss !== sentence.gloss) others.add(candidate.gloss)
  }
  return stableShuffle([sentence.gloss, ...others], `${cardId}|order`, (gloss) => gloss)
}

/**
 * Builds the exercise for a card from the current content. Returns null if
 * the card's content is gone or no longer supports it (a retired card that
 * slipped through), so the session can skip it instead of crashing.
 *
 * Expected answers only ever come from approved sentences, or — for
 * `inflect` — from `inflect()` output that card generation already checked
 * against an approved sentence (ADR-012).
 */
export function buildExercise(card: CardSpec, content: ExerciseContent): Exercise | null {
  const sentence = content.sentenceById.get(card.sentenceId)
  if (!sentence) return null
  const base = {
    cardId: card.id,
    feature: card.feature,
    ...(sentence.audio && card.kind !== 'inflect' ? { audio: sentence.audio } : {}),
  }

  switch (card.kind) {
    case 'cloze': {
      const token = card.tokenIndex === null ? undefined : sentence.tokens[card.tokenIndex]
      const lexeme = token && content.lexemeById.get(token.lexeme)
      if (!token || !lexeme || card.tokenIndex === null) return null
      return {
        ...base,
        kind: 'cloze',
        check: 'word',
        ...splitAroundToken(sentence, card.tokenIndex),
        lemma: lexeme.lemma,
        gloss: sentence.gloss,
        expected: token.surface,
      }
    }

    case 'recognize':
      return {
        ...base,
        kind: 'recognize',
        check: 'choice',
        text: sentence.text,
        choices: recognizeChoices(card.id, sentence, content.sentenceById.values()),
        expected: sentence.gloss,
      }

    case 'produce':
      return {
        ...base,
        kind: 'produce',
        check: 'sentence',
        gloss: sentence.gloss,
        expected: sentence.text,
      }

    case 'listen':
      if (!sentence.audio) return null
      return {
        ...base,
        kind: 'listen',
        check: 'sentence',
        audio: sentence.audio,
        gloss: sentence.gloss,
        expected: sentence.text,
      }

    case 'inflect': {
      const [lexemeId, formKey] = card.targetId.split('@')
      const [grammaticalCase, number] = formKey.split('.') as ['nom', 'sg']
      const lexeme = content.lexemeById.get(lexemeId)
      if (!lexeme || !content.grammar) return null
      const result = inflect(lexeme, { case: grammaticalCase, number }, content.grammar)
      if (!result.ok) return null
      return {
        ...base,
        kind: 'inflect',
        check: 'word',
        lemma: lexeme.lemma,
        lemmaGloss: lexeme.gloss[0],
        formLabel: `${featureLabel(`case:${grammaticalCase}`)} ${featureLabel(`number:${number}`)}`,
        expected: result.form,
      }
    }
  }
}
