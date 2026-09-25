import { buildGrammar, type Grammar } from '../engine/inflect.js'
import { checkRoundTrip } from './roundTrip.js'
import {
  grammarFileSchema,
  lexemeSchema,
  makeSentenceSchema,
  type GrammarFile,
  type Lexeme,
  type Sentence,
} from './schemas.js'

export interface ContentFile {
  path: string
  data: unknown
}

export interface ContentTree {
  lexemes: ContentFile[]
  sentences: ContentFile[]
  grammar: ContentFile[]
}

export interface ContentError {
  file: string
  message: string
}

export interface CheckResult {
  ok: boolean
  errors: ContentError[]
  /** Reported but not failing: round-trip gaps where the engine can't produce a form yet. */
  warnings: ContentError[]
}

function formatIssues(
  file: string,
  issues: { path: PropertyKey[]; message: string }[],
): ContentError[] {
  return issues.map((issue) => ({
    file,
    message: issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
  }))
}

function collectLexemeIds(lexemes: ContentFile[]): Set<string> {
  const ids = new Set<string>()
  for (const { data } of lexemes) {
    const id = (data as { id?: unknown } | null)?.id
    if (typeof id === 'string') ids.add(id)
  }
  return ids
}

/** Cross-file grammar rules a single file's schema can't express. */
function checkGrammarFiles(files: { path: string; file: GrammarFile }[]): ContentError[] {
  const errors: ContentError[] = []
  const tableOwner = new Map<string, string>()
  const alternationFiles: string[] = []

  for (const { path, file } of files) {
    if (file.kind === 'alternations') {
      alternationFiles.push(path)
      continue
    }
    const slot = `declension ${file.declension}, gender ${file.gender ?? 'any'}`
    const owner = tableOwner.get(slot)
    if (owner) {
      errors.push({ file: path, message: `duplicate ending table for ${slot} (also in ${owner})` })
    } else {
      tableOwner.set(slot, path)
    }
  }
  for (const path of alternationFiles.slice(1)) {
    errors.push({
      file: path,
      message: `only one alternations file is allowed (already have ${alternationFiles[0]})`,
    })
  }
  return errors
}

/**
 * Validates a whole content tree (already-parsed JSON, keyed by file path)
 * against the Zod schemas, including the cross-file lexeme-reference check
 * that a single file's schema can't express on its own. Shared by
 * `scripts/content-check.ts` and `scripts/content-approve.ts` so both tools
 * report the same errors the same way.
 *
 * Once every file is individually valid, it also runs the round-trip
 * annotation check (CLAUDE.md rule 6): a mismatch is an error, a gap in the
 * ending tables is a warning.
 */
export function checkContent(tree: ContentTree): CheckResult {
  const errors: ContentError[] = []
  const warnings: ContentError[] = []
  const lexemeIds = collectLexemeIds(tree.lexemes)
  const sentenceSchema = makeSentenceSchema(lexemeIds)

  const lexemeById = new Map<string, Lexeme>()
  for (const { path, data } of tree.lexemes) {
    const result = lexemeSchema.safeParse(data)
    if (!result.success) errors.push(...formatIssues(path, result.error.issues))
    else lexemeById.set(result.data.id, result.data)
  }

  const grammarFiles: { path: string; file: GrammarFile }[] = []
  for (const { path, data } of tree.grammar) {
    const result = grammarFileSchema.safeParse(data)
    if (!result.success) errors.push(...formatIssues(path, result.error.issues))
    else grammarFiles.push({ path, file: result.data })
  }
  errors.push(...checkGrammarFiles(grammarFiles))

  const sentences: { path: string; sentence: Sentence }[] = []
  for (const { path, data } of tree.sentences) {
    const result = sentenceSchema.safeParse(data)
    if (!result.success) errors.push(...formatIssues(path, result.error.issues))
    else sentences.push({ path, sentence: result.data })
  }

  if (errors.length === 0) {
    const pathById = new Map(sentences.map(({ path, sentence }) => [sentence.id, path]))
    const grammar = buildGrammar(grammarFiles.map(({ file }) => file))
    const findings = checkRoundTrip(
      sentences.map(({ sentence }) => sentence),
      lexemeById,
      grammar,
    )
    for (const finding of findings) {
      const entry = {
        file: pathById.get(finding.sentenceId) ?? finding.sentenceId,
        message: finding.message,
      }
      if (finding.kind === 'mismatch') errors.push(entry)
      else warnings.push(entry)
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

export type ApproveResult = { ok: true; sentence: Sentence } | { ok: false; errors: ContentError[] }

/** What a sentence is approved against: the current lexemes and grammar. */
export interface ApproveContext {
  lexemeById: ReadonlyMap<string, Lexeme>
  grammar: Grammar
}

/**
 * Builds an ApproveContext from a content tree, skipping files that don't
 * parse — those are reported by `checkContent`, not here.
 */
export function buildApproveContext(
  tree: Pick<ContentTree, 'lexemes' | 'grammar'>,
): ApproveContext {
  const lexemeById = new Map<string, Lexeme>()
  for (const { data } of tree.lexemes) {
    const result = lexemeSchema.safeParse(data)
    if (result.success) lexemeById.set(result.data.id, result.data)
  }
  const grammarFiles: GrammarFile[] = []
  for (const { data } of tree.grammar) {
    const result = grammarFileSchema.safeParse(data)
    if (result.success) grammarFiles.push(result.data)
  }
  return { lexemeById, grammar: buildGrammar(grammarFiles) }
}

/**
 * The pure core of `npm run content:approve` for sentences (ADR-006): a
 * draft is approved only if it validates, every lexeme it references is
 * itself approved (ADR-010 — the learner sees lemmas and glosses), and it
 * passes the round-trip check (CLAUDE.md rule 6), so an approved sentence
 * can never make the app's content fail to load. Only then does it get
 * `review`/`reviewedAt`. Never touches the filesystem.
 */
export function buildApprovedSentence(
  raw: unknown,
  context: ApproveContext,
  now: Date,
): ApproveResult {
  const schema = makeSentenceSchema(new Set(context.lexemeById.keys()))
  const result = schema.safeParse(raw)
  if (!result.success) {
    return { ok: false, errors: formatIssues('<draft>', result.error.issues) }
  }
  const sentence = result.data

  const errors: ContentError[] = []
  const unapproved = new Set<string>()
  for (const token of sentence.tokens) {
    if (context.lexemeById.get(token.lexeme)?.review !== 'approved') unapproved.add(token.lexeme)
  }
  for (const id of unapproved) {
    errors.push({
      file: '<draft>',
      message: `lexeme ${id} is not approved yet — approve content/lexemes/${id}.json first`,
    })
  }
  for (const finding of checkRoundTrip([sentence], context.lexemeById, context.grammar)) {
    if (finding.kind === 'mismatch') errors.push({ file: '<draft>', message: finding.message })
  }
  if (errors.length > 0) return { ok: false, errors }

  return { ok: true, sentence: { ...sentence, review: 'approved', reviewedAt: now.toISOString() } }
}

export type ApproveBatchItem =
  | { id: string; ok: true; sentence: Sentence }
  | { id: string; ok: false; errors: ContentError[]; raw: unknown }

function idOf(raw: unknown, index: number): string {
  const id = (raw as { id?: unknown } | null)?.id
  return typeof id === 'string' ? id : `#${index}`
}

/**
 * The batch form of `buildApprovedSentence`: approves what validates and
 * reports the rest individually, so one bad sentence in a batch doesn't block
 * the good ones. `scripts/content-approve.ts` uses `raw` on a failed item to
 * rewrite the draft file down to only what still needs fixing.
 */
export function buildApprovedSentences(
  rawList: unknown[],
  context: ApproveContext,
  now: Date,
): ApproveBatchItem[] {
  return rawList.map((raw, index) => {
    const id = idOf(raw, index)
    const result = buildApprovedSentence(raw, context, now)
    if (result.ok) return { id, ok: true, sentence: result.sentence }
    return { id, ok: false, errors: result.errors, raw }
  })
}

export type ApproveGrammarResult =
  { ok: true; file: GrammarFile } | { ok: false; errors: ContentError[] }

/**
 * The grammar-file form of `content:approve` (ADR-008): validates a grammar
 * file (ending table or alternation rules) and, only if it passes, returns it
 * with `review: "approved"` and `reviewedAt` set. Unlike sentences, grammar
 * files are approved in place — the `review` field, not the directory, is
 * the gate `inflect()` honors.
 */
export function buildApprovedGrammarFile(raw: unknown, now: Date): ApproveGrammarResult {
  const result = grammarFileSchema.safeParse(raw)
  if (!result.success) {
    return { ok: false, errors: formatIssues('<grammar>', result.error.issues) }
  }
  return { ok: true, file: { ...result.data, review: 'approved', reviewedAt: now.toISOString() } }
}

export type ApproveLexemeResult =
  { ok: true; lexeme: Lexeme } | { ok: false; errors: ContentError[] }

/**
 * The lexeme form of `content:approve` (ADR-010): validates one lexeme file
 * and returns it with `review: "approved"` + `reviewedAt`, approved in place.
 */
export function buildApprovedLexeme(raw: unknown, now: Date): ApproveLexemeResult {
  const result = lexemeSchema.safeParse(raw)
  if (!result.success) {
    return { ok: false, errors: formatIssues('<lexeme>', result.error.issues) }
  }
  return { ok: true, lexeme: { ...result.data, review: 'approved', reviewedAt: now.toISOString() } }
}
