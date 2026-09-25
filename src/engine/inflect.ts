import type {
  AlternationsFile,
  Features,
  FormKey,
  GrammarFile,
  Lexeme,
  NounEndingTable,
} from '../content/schemas.js'

/** The grammar data `inflect()` reads — built once from content/grammar/. */
export interface Grammar {
  nounTables: NounEndingTable[]
  alternations: AlternationsFile | null
}

/**
 * `verified` means every piece of data that produced the form went through
 * human review: an `irregular` override or the lemma itself (lexemes are
 * human-authored, ADR-004), or table cells and alternation rules from files
 * with `review: "approved"` (ADR-008). Anything else is `unverified` and must
 * not be shown to a learner as the expected answer.
 */
export type Confidence = 'verified' | 'unverified'

export type InflectFailure =
  'unsupported-pos' | 'missing-features' | 'no-declension' | 'no-table' | 'lemma-mismatch' | 'gap'

export type InflectResult =
  | { ok: true; form: string; confidence: Confidence; source: 'lemma' | 'irregular' | 'table' }
  | { ok: false; reason: InflectFailure; message: string }

export function buildGrammar(files: readonly GrammarFile[]): Grammar {
  const nounTables: NounEndingTable[] = []
  let alternations: AlternationsFile | null = null
  for (const file of files) {
    if (file.kind === 'noun-endings') nounTables.push(file)
    else alternations = file
  }
  return { nounTables, alternations }
}

function fail(reason: InflectFailure, message: string): InflectResult {
  return { ok: false, reason, message }
}

function findTable(grammar: Grammar, lexeme: Lexeme): NounEndingTable | undefined {
  const inDeclension = grammar.nounTables.filter((t) => t.declension === lexeme.declension)
  return (
    inDeclension.find((t) => t.gender !== null && t.gender === lexeme.gender) ??
    inDeclension.find((t) => t.gender === null)
  )
}

function longestSuffix<T>(word: string, items: readonly T[], suffixOf: (item: T) => string) {
  let best: T | undefined
  for (const item of items) {
    const suffix = suffixOf(item)
    if (word.endsWith(suffix) && (best === undefined || suffix.length > suffixOf(best).length)) {
      best = item
    }
  }
  return best
}

/**
 * Returns the alternated stem, or null if this form is not an alternation
 * slot for the declension. Inside a slot, a stem that no rule matches (e.g.
 * one ending in k or r) comes back unchanged — but the rule file was still
 * consulted, so its review state still counts toward the form's confidence.
 */
function alternate(
  stem: string,
  declension: number,
  key: FormKey,
  alternations: AlternationsFile | null,
): string | null {
  if (!alternations) return null
  const applies = alternations.appliesTo.some(
    (entry) => entry.declension === declension && entry.forms.includes(key),
  )
  if (!applies) return null
  const rule = longestSuffix(stem, alternations.rules, (r) => r.from)
  if (!rule) return stem
  return stem.slice(0, stem.length - rule.from.length) + rule.to
}

/**
 * Produces the inflected form of a noun lexeme for a case + number, from the
 * ending tables and alternation rules in content/grammar/. Never guesses: a
 * missing table cell is reported as a `gap`, not filled with something
 * plausible. Order of precedence:
 *
 * 1. the lexeme's `irregular[key]` override, if present;
 * 2. nom.sg is the lemma itself;
 * 3. stem (lemma minus its longest matching table `lemmaEndings` entry),
 *    alternated if content/grammar/alternations.json lists this form for this
 *    declension, plus the table's ending.
 */
export function inflect(lexeme: Lexeme, features: Features, grammar: Grammar): InflectResult {
  if (lexeme.pos !== 'noun') {
    return fail('unsupported-pos', `inflect() only supports nouns so far, not ${lexeme.pos}`)
  }
  const { case: grammaticalCase, number } = features
  if (!grammaticalCase || !number) {
    return fail('missing-features', 'a noun form needs both case and number')
  }
  const key: FormKey = `${grammaticalCase}.${number}`

  const override = lexeme.irregular?.[key]
  if (override !== undefined) {
    return { ok: true, form: override, confidence: 'verified', source: 'irregular' }
  }
  if (key === 'nom.sg') {
    return { ok: true, form: lexeme.lemma, confidence: 'verified', source: 'lemma' }
  }

  if (lexeme.declension === null) {
    return fail('no-declension', `${lexeme.id} has no declension class and no override for ${key}`)
  }
  const table = findTable(grammar, lexeme)
  if (!table) {
    return fail(
      'no-table',
      `no ending table for declension ${lexeme.declension} (gender ${lexeme.gender ?? 'none'})`,
    )
  }
  const lemmaEnding = longestSuffix(lexeme.lemma, table.lemmaEndings, (e) => e)
  if (lemmaEnding === undefined) {
    return fail(
      'lemma-mismatch',
      `lemma "${lexeme.lemma}" ends in none of ${table.id}'s lemma endings (${table.lemmaEndings.join(', ')})`,
    )
  }
  const ending = table.endings[number][grammaticalCase]
  if (ending === undefined) {
    return fail('gap', `${table.id} has no ending for ${key}`)
  }

  const stem = lexeme.lemma.slice(0, lexeme.lemma.length - lemmaEnding.length)
  const alternated = alternate(stem, lexeme.declension, key, grammar.alternations)
  const verified =
    table.review === 'approved' &&
    (alternated === null || grammar.alternations?.review === 'approved')

  return {
    ok: true,
    form: (alternated ?? stem) + ending,
    confidence: verified ? 'verified' : 'unverified',
    source: 'table',
  }
}
