import type { FormKey, Lexeme, NounEndingTable, Sentence } from '../content/schemas'
import { inflect, type Confidence, type Grammar } from './inflect'

/**
 * The data behind the Grammar tab's reference pages. Pure: everything is
 * derived from content (lexemes, grammar tables, approved sentences) through
 * `inflect()`, never typed in (CLAUDE.md rule 5).
 */

export const CASE_ORDER = ['nom', 'gen', 'dat', 'acc', 'ins', 'loc', 'voc'] as const
export type Case = (typeof CASE_ORDER)[number]
export type GrammaticalNumber = 'sg' | 'pl'

export interface FormCell {
  form: string
  confidence: Confidence
}

/** Every case × number of a word; null where `inflect()` has no form (a gap). */
export type Paradigm = Record<FormKey, FormCell | null>

/**
 * For pronouns only the forms listed in the lexeme count: `inflect()` falls
 * back to the lemma for nom.sg, which is wrong for a plural-only pronoun
 * (mēs) or one with no nominative (sevis).
 */
export function paradigmOf(lexeme: Lexeme, grammar: Grammar): Paradigm {
  const paradigm = {} as Paradigm
  for (const number of ['sg', 'pl'] as const) {
    for (const grammaticalCase of CASE_ORDER) {
      const result = inflect(lexeme, { case: grammaticalCase, number }, grammar)
      const usable = result.ok && (lexeme.pos !== 'pronoun' || result.source === 'irregular')
      paradigm[`${grammaticalCase}.${number}`] = usable
        ? { form: result.form, confidence: result.confidence }
        : null
    }
  }
  return paradigm
}

/** Whether a paradigm has any form in this number — a pronoun table's columns. */
export function hasNumber(paradigm: Paradigm, number: GrammaticalNumber): boolean {
  return CASE_ORDER.some((grammaticalCase) => paradigm[`${grammaticalCase}.${number}`] !== null)
}

/**
 * The forms of a noun whose stem consonant changes (brālis → brāļa): the
 * alternation file lists the form for the noun's declension and a rule
 * actually rewrites the stem. For highlighting in the tables.
 */
export function alternatedForms(lexeme: Lexeme, grammar: Grammar): Set<FormKey> {
  const keys = new Set<FormKey>()
  const alternations = grammar.alternations
  if (lexeme.pos !== 'noun' || !alternations || lexeme.declension === null) return keys
  const table =
    grammar.nounTables.find(
      (t) => t.declension === lexeme.declension && t.gender !== null && t.gender === lexeme.gender,
    ) ?? grammar.nounTables.find((t) => t.declension === lexeme.declension && t.gender === null)
  const ending = table?.lemmaEndings
    .filter((e) => lexeme.lemma.endsWith(e))
    .sort((a, b) => b.length - a.length)[0]
  if (ending === undefined) return keys
  const stem = lexeme.lemma.slice(0, lexeme.lemma.length - ending.length)
  const rule = alternations.rules
    .filter((r) => stem.endsWith(r.from))
    .sort((a, b) => b.from.length - a.from.length)[0]
  if (!rule || rule.from === rule.to) return keys
  for (const entry of alternations.appliesTo) {
    if (entry.declension !== lexeme.declension) continue
    for (const key of entry.forms) if (!lexeme.irregular?.[key]) keys.add(key)
  }
  return keys
}

/**
 * The paradigm as a learner may see it: unverified forms dropped, unless
 * `includeUnverified` (the draft preview build, ADR-011).
 */
export function visibleParadigm(paradigm: Paradigm, includeUnverified: boolean): Paradigm {
  const visible = {} as Paradigm
  for (const [key, cell] of Object.entries(paradigm) as [FormKey, FormCell | null][]) {
    visible[key] = cell && (includeUnverified || cell.confidence === 'verified') ? cell : null
  }
  return visible
}

export interface DeclensionReference {
  table: NounEndingTable
  examples: { lexeme: Lexeme; paradigm: Paradigm }[]
}

function verifiedCount(paradigm: Paradigm): number {
  return Object.values(paradigm).filter((cell) => cell?.confidence === 'verified').length
}

/**
 * One entry per noun ending table, in declension order, each with up to
 * `perTable` example nouns. Examples are common nouns (proper names like
 * Rīga have odd plurals) that the approved sentences use, most complete
 * paradigm first, then alphabetical.
 */
export function declensionReference(
  sentences: Iterable<Sentence>,
  lexemeById: ReadonlyMap<string, Lexeme>,
  grammar: Grammar,
  perTable = 2,
): DeclensionReference[] {
  const used = new Set<string>()
  for (const sentence of sentences) for (const token of sentence.tokens) used.add(token.lexeme)

  const tables = [...grammar.nounTables].sort(
    (a, b) => a.declension - b.declension || (a.gender ?? '').localeCompare(b.gender ?? ''),
  )
  return tables.map((table) => {
    const candidates = [...lexemeById.values()]
      .filter(
        (lexeme) =>
          lexeme.pos === 'noun' &&
          lexeme.declension === table.declension &&
          (table.gender === null || lexeme.gender === table.gender) &&
          used.has(lexeme.id) &&
          lexeme.lemma === lexeme.lemma.toLocaleLowerCase('lv'),
      )
      .map((lexeme) => ({ lexeme, paradigm: paradigmOf(lexeme, grammar) }))
      .sort(
        (a, b) =>
          verifiedCount(b.paradigm) - verifiedCount(a.paradigm) ||
          a.lexeme.lemma.localeCompare(b.lexeme.lemma, 'lv'),
      )
    return { table, examples: candidates.slice(0, perTable) }
  })
}

export interface PrepositionUse {
  case: Case
  number: GrammaticalNumber
  sentence: Sentence
  /** The token that takes the case (the noun or pronoun after the preposition). */
  tokenIndex: number
}

export interface PrepositionReference {
  preposition: Lexeme
  uses: PrepositionUse[]
}

/**
 * Which case each preposition takes, read off the approved sentences: the
 * first token after the preposition that carries a case. One example per
 * (preposition, case, number); prepositions alphabetical.
 */
export function prepositionReference(
  sentences: Iterable<Sentence>,
  lexemeById: ReadonlyMap<string, Lexeme>,
): PrepositionReference[] {
  const byPreposition = new Map<string, PrepositionReference>()
  const ordered = [...sentences].sort((a, b) => (a.id < b.id ? -1 : 1))
  for (const sentence of ordered) {
    sentence.tokens.forEach((token, index) => {
      const preposition = lexemeById.get(token.lexeme)
      if (preposition?.pos !== 'preposition') return
      const objectIndex = sentence.tokens.findIndex(
        (other, j) => j > index && other.features.case !== undefined,
      )
      if (objectIndex < 0) return
      const object = sentence.tokens[objectIndex].features
      if (!object.case || !object.number) return
      const entry = byPreposition.get(preposition.id) ?? { preposition, uses: [] }
      byPreposition.set(preposition.id, entry)
      if (entry.uses.some((u) => u.case === object.case && u.number === object.number)) return
      entry.uses.push({
        case: object.case,
        number: object.number,
        sentence,
        tokenIndex: objectIndex,
      })
    })
  }
  return [...byPreposition.values()].sort((a, b) =>
    a.preposition.lemma.localeCompare(b.preposition.lemma, 'lv'),
  )
}

/** Pronoun groups, in the order a grammar lists them; a lexeme joins one via its `pronoun:<group>` tag. */
export const PRONOUN_GROUPS = [
  { id: 'personal', label: 'Personal', description: 'I, you, he, she, we, they.' },
  {
    id: 'reflexive',
    label: 'Reflexive',
    description: 'Oneself — points back to the subject. It has no nominative.',
  },
  {
    id: 'possessive',
    label: 'Possessive',
    description: 'My, your, one’s own. They decline like adjectives and agree with the noun.',
  },
  { id: 'demonstrative', label: 'Demonstrative', description: 'This, that, such.' },
  {
    id: 'interrogative',
    label: 'Interrogative and relative',
    description: 'Who, what, which — in questions, and to join clauses.',
  },
  { id: 'indefinite', label: 'Indefinite', description: 'Someone, something, some kind of.' },
  { id: 'negative', label: 'Negative', description: 'Nobody, nothing, no kind of.' },
  { id: 'definitive', label: 'Definitive', description: 'Self, all, each, every.' },
] as const

export type PronounGroupId = (typeof PRONOUN_GROUPS)[number]['id']

export interface PronounGroup {
  id: PronounGroupId
  label: string
  description: string
  pronouns: Lexeme[]
}

/** The groups a pronoun lexeme belongs to, from its `pronoun:<group>` tags (kāds is in two). */
export function pronounGroupsOf(lexeme: Lexeme): PronounGroupId[] {
  return PRONOUN_GROUPS.filter((group) => lexeme.tags.includes(`pronoun:${group.id}`)).map(
    (group) => group.id,
  )
}

/**
 * Pronoun lexemes grouped by type. Only approved lexemes, unless
 * `includeDrafts` (the preview build); untagged pronouns go nowhere. Within
 * a group, `order:<n>` tags decide (es, tu, viņš … in person order), then
 * alphabetical.
 */
export function pronounGroups(
  lexemeById: ReadonlyMap<string, Lexeme>,
  includeDrafts: boolean,
): PronounGroup[] {
  const groups: PronounGroup[] = PRONOUN_GROUPS.map((g) => ({ ...g, pronouns: [] }))
  for (const lexeme of lexemeById.values()) {
    if (lexeme.pos !== 'pronoun') continue
    if (!includeDrafts && lexeme.review !== 'approved') continue
    for (const id of pronounGroupsOf(lexeme)) groups.find((g) => g.id === id)?.pronouns.push(lexeme)
  }
  for (const group of groups) {
    group.pronouns.sort((a, b) => rankOf(a) - rankOf(b) || a.lemma.localeCompare(b.lemma, 'lv'))
  }
  return groups.filter((g) => g.pronouns.length > 0)
}

/** A lexeme's `order:<n>` tag, or last. */
function rankOf(lexeme: Lexeme): number {
  const tag = lexeme.tags.find((t) => t.startsWith('order:'))
  return tag ? Number(tag.slice('order:'.length)) : Number.MAX_SAFE_INTEGER
}

/** Pronouns that exist in the content but are not approved yet — for the "waiting for review" note. */
export function draftPronounCount(lexemeById: ReadonlyMap<string, Lexeme>): number {
  return [...lexemeById.values()].filter((l) => l.pos === 'pronoun' && l.review !== 'approved')
    .length
}
