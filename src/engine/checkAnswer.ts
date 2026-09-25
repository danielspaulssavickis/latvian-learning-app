export type CheckResult = 'correct' | 'nearMiss' | 'wrong'

export interface CheckOptions {
  /**
   * For whole-sentence answers: ignore punctuation, so "Es dzīvoju Rīgā"
   * matches "Es dzīvoju Rīgā." Never used for single words.
   */
  ignorePunctuation?: boolean
}

/** NFC, trimmed, internal whitespace collapsed to one space. Case is kept. */
function tidy(text: string, options: CheckOptions = {}): string {
  const nfc = text.normalize('NFC')
  const bare = options.ignorePunctuation ? nfc.replace(/[\p{P}]/gu, ' ') : nfc
  return bare.trim().replace(/\s+/g, ' ')
}

function caseFold(text: string): string {
  return text.toLocaleLowerCase('lv')
}

/**
 * Strips every combining mark: ā → a, ķ → k, š → s. Latvian letters are one
 * base letter plus one mark in NFD, so this maps each letter to exactly one
 * letter and never changes the character count of NFC input.
 */
function foldDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC')
}

/**
 * The answer-checking contract from SPEC.md and CLAUDE.md rule 3:
 * `correct` on an exact match after NFC + trim + whitespace collapse + case
 * fold; `nearMiss` when the only difference is diacritics (on either side);
 * `wrong` otherwise. No edit distance: a one-letter difference in Latvian is
 * usually a different case, not a typo.
 */
export function checkAnswer(
  expected: string,
  given: string,
  options: CheckOptions = {},
): CheckResult {
  const want = caseFold(tidy(expected, options))
  const got = caseFold(tidy(given, options))
  if (got === '') return 'wrong'
  if (want === got) return 'correct'
  if (foldDiacritics(want) === foldDiacritics(got)) return 'nearMiss'
  return 'wrong'
}

export interface DiffSegment {
  text: string
  /** True where the learner's letter had a different (usually missing) diacritic. */
  differs: boolean
}

/**
 * For a near miss, the expected spelling split per letter with the letters
 * whose diacritic the learner got wrong marked — what the review screen
 * highlights. Returns null for anything that isn't a near miss.
 */
export function diacriticDiff(
  expected: string,
  given: string,
  options: CheckOptions = {},
): DiffSegment[] | null {
  if (checkAnswer(expected, given, options) !== 'nearMiss') return null
  const want = [...tidy(expected, options)]
  const got = [...caseFold(tidy(given, options))]
  return want.map((letter, index) => ({
    text: letter,
    differs: caseFold(letter) !== got[index],
  }))
}
