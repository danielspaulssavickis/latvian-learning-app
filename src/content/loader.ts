import { lexemeSchema, makeSentenceSchema, type Lexeme, type Sentence } from './schemas.js'
import { checkContent, type ContentFile } from './validate.js'

export interface ContentRecords {
  /** Keyed by file path, e.g. "content/lexemes/lex_maja.json" -> parsed JSON. */
  lexemes: Record<string, unknown>
  sentences: Record<string, unknown>
  grammar: Record<string, unknown>
}

export interface LoadedContent {
  lexemeById: Map<string, Lexeme>
  sentencesByLevel: Map<Sentence['level'], Sentence[]>
  /** Keyed like "case:loc", built only from each sentence's drillable tokens. */
  sentencesByFeature: Map<string, Sentence[]>
}

function toContentFiles(records: Record<string, unknown>): ContentFile[] {
  return Object.entries(records).map(([path, data]) => ({ path, data }))
}

/**
 * Builds the in-memory content index from already-parsed JSON. Pure and
 * synchronous — no filesystem or Vite APIs — so it is unit-testable directly.
 * The real app wires this to `import.meta.glob` output in
 * src/content/index.ts; `scripts/content-check.ts` uses `checkContent`
 * directly instead, since it needs per-file errors rather than a thrown
 * exception.
 */
export function loadContent(records: ContentRecords): LoadedContent {
  const tree = {
    lexemes: toContentFiles(records.lexemes),
    sentences: toContentFiles(records.sentences),
    grammar: toContentFiles(records.grammar),
  }

  const result = checkContent(tree)
  if (!result.ok) {
    const details = result.errors.map((error) => `  ${error.file}: ${error.message}`).join('\n')
    throw new Error(`Invalid content:\n${details}`)
  }

  const lexemeById = new Map<string, Lexeme>()
  for (const { data } of tree.lexemes) {
    const lexeme = lexemeSchema.parse(data)
    lexemeById.set(lexeme.id, lexeme)
  }

  const lexemeIds = new Set(lexemeById.keys())
  const sentenceSchema = makeSentenceSchema(lexemeIds)
  const sentences = tree.sentences.map(({ data }) => sentenceSchema.parse(data))

  const sentencesByLevel = new Map<Sentence['level'], Sentence[]>()
  const sentencesByFeature = new Map<string, Sentence[]>()

  for (const sentence of sentences) {
    const byLevel = sentencesByLevel.get(sentence.level) ?? []
    byLevel.push(sentence)
    sentencesByLevel.set(sentence.level, byLevel)

    for (const token of sentence.tokens) {
      if (!token.drillable) continue
      for (const [key, value] of Object.entries(token.features)) {
        const featureKey = `${key}:${value}`
        const byFeature = sentencesByFeature.get(featureKey) ?? []
        byFeature.push(sentence)
        sentencesByFeature.set(featureKey, byFeature)
      }
    }
  }

  return { lexemeById, sentencesByLevel, sentencesByFeature }
}
