export type CheckResult = 'correct' | 'nearMiss' | 'wrong'

export interface CheckOptions {
  /**
   * For whole-sentence answers: ignore punctuation, so "Es dzīvoju Rīgā"
   * matches "Es dzīvoju Rīgā." Never used for single words.
   */
  ignorePunctuation?: boolean
  /**
   * Other real forms of the same word that differ from `expected` only by
   * diacritics (ADR-014). Typing one of these exactly is a different case,
   * not a slipped macron, so it is `wrong` — "galda" (genitive) for "galdā"
   * (locative). A diacritic-folded spelling that is no real form ("Riga" for
   * "Rīgā") is still a near miss.
   */
  confusables?: readonly Confusable[]
  /**
   * Other answers accepted as correct besides `expected` (ADR-016): a
   * sentence's reviewed alternative word orders or phrasings. Each is checked
   * exactly like `expected`; the best result wins.
   */
  alternatives?: readonly string[]
  /**
   * The language of the answer. Latvian (the default) grades diacritics;
   * English folds contractions ("I'm" = "I am", "don't" = "do not") because
   * both are the same English, and diacritics never come into it.
   */
  language?: 'lv' | 'en'
}

export interface Confusable {
  form: string
  /** Learner-facing name of the form, e.g. "genitive singular". */
  label: string
}

/** English contractions, folded on both sides so "I'm" and "I am" compare equal. */
const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/n't\b/g, ' not'],
  [/\b(i)'m\b/g, '$1 am'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
  [/\b(let)'s\b/g, '$1 us'],
  // 's is "is" after these; elsewhere (he's got, the dog's) it stays as typed.
  [/\b(it|that|this|there|here|what|who|where|how)'s\b/g, '$1 is'],
]

function foldContractions(text: string): string {
  let folded = text.replace(/[’‘]/g, "'")
  for (const [pattern, replacement] of CONTRACTIONS) folded = folded.replace(pattern, replacement)
  return folded
}

/** NFC, trimmed, internal whitespace collapsed to one space. Case is kept. */
function tidy(text: string, options: CheckOptions = {}): string {
  const nfc = text.normalize('NFC')
  const english = options.language === 'en' ? foldContractions(nfc.toLocaleLowerCase('en')) : nfc
  const bare = options.ignorePunctuation ? english.replace(/[\p{P}]/gu, ' ') : english
  return bare.trim().replace(/\s+/g, ' ')
}

function caseFold(text: string, options: CheckOptions = {}): string {
  return text.toLocaleLowerCase(options.language ?? 'lv')
}

/**
 * Strips every combining mark: ā → a, ķ → k, š → s. Latvian letters are one
 * base letter plus one mark in NFD, so this maps each letter to exactly one
 * letter and never changes the character count of NFC input.
 */
function foldDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC')
}

function checkOne(expected: string, given: string, options: CheckOptions): CheckResult {
  const want = caseFold(tidy(expected, options), options)
  const got = caseFold(tidy(given, options), options)
  if (got === '') return 'wrong'
  if (want === got) return 'correct'
  if (foldDiacritics(want) !== foldDiacritics(got)) return 'wrong'
  return matchConfusable(given, options) ? 'wrong' : 'nearMiss'
}

const RANK: Record<CheckResult, number> = { correct: 2, nearMiss: 1, wrong: 0 }

export interface Match {
  result: CheckResult
  /** The accepted answer the learner's came closest to: `expected` unless an alternative did better. */
  target: string
}

/**
 * `checkAnswer` plus which accepted answer it was measured against, so the
 * feedback can diff a near miss against the alternative the learner was
 * actually writing. Ties go to `expected`.
 */
export function matchAnswer(expected: string, given: string, options: CheckOptions = {}): Match {
  let best: Match = { result: checkOne(expected, given, options), target: expected }
  for (const alternative of options.alternatives ?? []) {
    if (best.result === 'correct') break
    const result = checkOne(alternative, given, options)
    if (RANK[result] > RANK[best.result]) best = { result, target: alternative }
  }
  return best
}

/**
 * The answer-checking contract from SPEC.md and CLAUDE.md rule 3:
 * `correct` on an exact match after NFC + trim + whitespace collapse + case
 * fold; `nearMiss` when the only difference is diacritics (on either side);
 * `wrong` otherwise. No edit distance: a one-letter difference in Latvian is
 * usually a different case, not a typo. With `alternatives`, the best match
 * among all accepted answers counts.
 */
export function checkAnswer(
  expected: string,
  given: string,
  options: CheckOptions = {},
): CheckResult {
  return matchAnswer(expected, given, options).result
}

/** The other form of the word the answer exactly is, if any (see CheckOptions.confusables). */
export function matchConfusable(given: string, options: CheckOptions = {}): Confusable | null {
  const got = caseFold(tidy(given, options), options)
  return options.confusables?.find((c) => caseFold(tidy(c.form, options), options) === got) ?? null
}

/** True when two spellings differ only by diacritics (and case). */
export function sameLettersIgnoringDiacritics(a: string, b: string): boolean {
  return foldDiacritics(caseFold(tidy(a))) === foldDiacritics(caseFold(tidy(b)))
}

export interface DiffSegment {
  text: string
  /** True where the learner's letter had a different (usually missing) diacritic. */
  differs: boolean
}

/**
 * For a near miss, the expected spelling split per letter with the letters
 * whose diacritic the learner got wrong marked — what the review screen
 * highlights. Measured against the accepted answer the learner came closest
 * to (see `matchAnswer`). Returns null for anything that isn't a near miss.
 */
export function diacriticDiff(
  expected: string,
  given: string,
  options: CheckOptions = {},
): DiffSegment[] | null {
  const match = matchAnswer(expected, given, options)
  if (match.result !== 'nearMiss') return null
  const want = [...tidy(match.target, options)]
  const got = [...caseFold(tidy(given, options), options)]
  return want.map((letter, index) => ({
    text: letter,
    differs: caseFold(letter, options) !== got[index],
  }))
}
