import { grammarTableSchema, lexemeSchema, makeSentenceSchema, type Sentence } from './schemas.js'

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
}

function formatIssues(file: string, issues: { path: PropertyKey[]; message: string }[]): ContentError[] {
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

/**
 * Validates a whole content tree (already-parsed JSON, keyed by file path)
 * against the Zod schemas, including the cross-file lexeme-reference check
 * that a single file's schema can't express on its own. Shared by
 * `scripts/content-check.ts` and `scripts/content-approve.ts` so both tools
 * report the same errors the same way.
 */
export function checkContent(tree: ContentTree): CheckResult {
  const errors: ContentError[] = []
  const lexemeIds = collectLexemeIds(tree.lexemes)
  const sentenceSchema = makeSentenceSchema(lexemeIds)

  for (const { path, data } of tree.lexemes) {
    const result = lexemeSchema.safeParse(data)
    if (!result.success) errors.push(...formatIssues(path, result.error.issues))
  }

  for (const { path, data } of tree.grammar) {
    const result = grammarTableSchema.safeParse(data)
    if (!result.success) errors.push(...formatIssues(path, result.error.issues))
  }

  for (const { path, data } of tree.sentences) {
    const result = sentenceSchema.safeParse(data)
    if (!result.success) errors.push(...formatIssues(path, result.error.issues))
  }

  return { ok: errors.length === 0, errors }
}

export type ApproveResult =
  | { ok: true; sentence: Sentence }
  | { ok: false; errors: ContentError[] }

/**
 * The pure core of `npm run content:approve` (ADR-006): validates a draft
 * sentence against the known lexeme ids and, only if it passes, returns the
 * sentence with `review`/`reviewedAt` set. Never touches the filesystem —
 * that's `scripts/content-approve.ts`'s job — so the approval logic itself is
 * unit-testable without a real draft file.
 */
export function buildApprovedSentence(
  raw: unknown,
  validLexemeIds: ReadonlySet<string>,
  now: Date,
): ApproveResult {
  const schema = makeSentenceSchema(validLexemeIds)
  const result = schema.safeParse(raw)
  if (!result.success) {
    return { ok: false, errors: formatIssues('<draft>', result.error.issues) }
  }
  return {
    ok: true,
    sentence: { ...result.data, review: 'approved', reviewedAt: now.toISOString() },
  }
}
