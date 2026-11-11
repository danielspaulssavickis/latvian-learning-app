import type { Lexeme, Sentence } from '../content/schemas'

export type Pos = Lexeme['pos']

export interface WordClass {
  pos: Pos
  /** Learner-facing English name (CLAUDE.md rule 4). */
  english: string
  /** The Latvian grammar term, shown alongside. */
  latvian: string
  /** Short label under a word on a card. */
  short: string
  /** What the class is and what to watch for in Latvian. */
  description: string
}

/**
 * Every part of speech the content schema allows, in the order a grammar
 * would list them. The descriptions are the only prose here; examples on
 * the word-classes screen come from approved sentences (`examplesFor`), so
 * the app never shows a learner Latvian no one has reviewed.
 */
export const WORD_CLASSES: readonly WordClass[] = [
  {
    pos: 'noun',
    english: 'noun',
    latvian: 'lietvārds',
    short: 'noun',
    description:
      'Names a person, thing, place or idea. Latvian nouns have a gender and fall into six declensions; they change their ending for seven cases and two numbers. Most cloze cards drill a noun ending.',
  },
  {
    pos: 'verb',
    english: 'verb',
    latvian: 'darbības vārds',
    short: 'verb',
    description:
      'An action or state. Verbs change for person, number and tense across three conjugations. The jā- prefix makes the debitive ("have to"), which takes its subject in the dative: man jāstrādā.',
  },
  {
    pos: 'adjective',
    english: 'adjective',
    latvian: 'īpašības vārds',
    short: 'adj.',
    description:
      'Describes a noun and agrees with it in gender, number and case. Latvian adjectives also have definite and indefinite endings (a specific thing vs. any such thing).',
  },
  {
    pos: 'pronoun',
    english: 'pronoun',
    latvian: 'vietniekvārds',
    short: 'pron.',
    description:
      'Stands in for a noun: I, you, he, she, we, that. Pronouns decline like nouns but each has its own irregular set of forms, so they are learned one by one.',
  },
  {
    pos: 'adverb',
    english: 'adverb',
    latvian: 'apstākļa vārds',
    short: 'adv.',
    description:
      'Says how, when, where or how much something happens. Adverbs never change their form, which makes them a rest from endings.',
  },
  {
    pos: 'preposition',
    english: 'preposition',
    latvian: 'prievārds',
    short: 'prep.',
    description:
      'Links a noun to the rest of the sentence and decides its case: in the singular each preposition governs its own case (uz + accusative for direction, no / pie / bez / zem + genitive, ar + instrumental); in the plural almost all of them take the dative.',
  },
  {
    pos: 'conjunction',
    english: 'conjunction',
    latvian: 'saiklis',
    short: 'conj.',
    description:
      'Joins words or clauses: and, but, because, that. Conjunctions do not change their form.',
  },
  {
    pos: 'particle',
    english: 'particle',
    latvian: 'partikula',
    short: 'part.',
    description:
      'A small unchanging word that shades the meaning of a sentence — negation, emphasis, a yes/no question marker.',
  },
  {
    pos: 'numeral',
    english: 'numeral',
    latvian: 'skaitļa vārds',
    short: 'num.',
    description:
      'A number word. Most Latvian numerals decline and agree with their noun like adjectives do; one, two and three have forms for both genders.',
  },
  {
    pos: 'interjection',
    english: 'interjection',
    latvian: 'izsauksmes vārds',
    short: 'interj.',
    description: 'An exclamation that stands on its own and never changes its form.',
  },
]

const BY_POS = new Map(WORD_CLASSES.map((wordClass) => [wordClass.pos, wordClass]))

export function wordClassOf(pos: Pos): WordClass {
  const found = BY_POS.get(pos)
  if (!found) throw new Error(`unknown part of speech: ${pos}`)
  return found
}

/** One piece of a sentence's text: a word (with its token) or the punctuation and spaces between words. */
export interface SentenceWord {
  text: string
  /** Index into `sentence.tokens`, or null for text between tokens. */
  tokenIndex: number | null
  pos?: Pos
}

/**
 * Splits a sentence's text into its tokens and the text between them, in
 * order, so the UI can mark each word. Walks the tokens like
 * `splitAroundToken` does, so repeated words resolve to the right occurrence.
 */
export function segmentSentence(
  sentence: Sentence,
  lexemeById: ReadonlyMap<string, Lexeme>,
): SentenceWord[] {
  const words: SentenceWord[] = []
  let cursor = 0
  sentence.tokens.forEach((token, tokenIndex) => {
    const found = sentence.text.indexOf(token.surface, cursor)
    if (found < 0) {
      throw new Error(
        `${sentence.id}: token ${tokenIndex} "${token.surface}" not found in its text in order`,
      )
    }
    if (found > cursor) words.push({ text: sentence.text.slice(cursor, found), tokenIndex: null })
    const pos = lexemeById.get(token.lexeme)?.pos
    words.push({ text: token.surface, tokenIndex, ...(pos ? { pos } : {}) })
    cursor = found + token.surface.length
  })
  if (cursor < sentence.text.length) {
    words.push({ text: sentence.text.slice(cursor), tokenIndex: null })
  }
  return words
}

export interface WordClassExample {
  sentence: Sentence
  /** The token of this class in the sentence. */
  tokenIndex: number
  lexeme: Lexeme
}

/**
 * Up to `limit` approved sentences that contain a word of this class, one
 * per sentence and no lexeme twice, in content order — the examples for the
 * word-classes screen.
 */
export function examplesFor(
  pos: Pos,
  sentences: Iterable<Sentence>,
  lexemeById: ReadonlyMap<string, Lexeme>,
  limit = 3,
): WordClassExample[] {
  const examples: WordClassExample[] = []
  const usedLexemes = new Set<string>()
  const ordered = [...sentences].sort((a, b) => (a.id < b.id ? -1 : 1))
  for (const sentence of ordered) {
    if (examples.length >= limit) break
    const tokenIndex = sentence.tokens.findIndex(
      (token) => lexemeById.get(token.lexeme)?.pos === pos && !usedLexemes.has(token.lexeme),
    )
    if (tokenIndex < 0) continue
    const lexeme = lexemeById.get(sentence.tokens[tokenIndex].lexeme)!
    usedLexemes.add(lexeme.id)
    examples.push({ sentence, tokenIndex, lexeme })
  }
  return examples
}
