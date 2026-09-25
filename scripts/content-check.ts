#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkContent, type ContentFile } from '../src/content/validate.js'

const CONTENT_ROOT = join(process.cwd(), 'content')

function readJsonFiles(dir: string): ContentFile[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const path = join(dir, name)
      const relativePath = path.slice(process.cwd().length + 1)
      try {
        return { path: relativePath, data: JSON.parse(readFileSync(path, 'utf-8')) }
      } catch (error) {
        return { path: relativePath, data: { __parseError: String(error) } }
      }
    })
}

// content/drafts is excluded by default (ADR-006): content:check validates
// published content. `--drafts` also checks every draft sentence (schema +
// round-trip) as if it were published — the pre-flight for content:approve.
const includeDrafts = process.argv.includes('--drafts')

/** Draft files hold one sentence or an array of them; split arrays per sentence. */
function readDrafts(dir: string): ContentFile[] {
  return readJsonFiles(dir).flatMap(({ path, data }) =>
    Array.isArray(data)
      ? data.map((sentence, index) => ({ path: `${path}[${index}]`, data: sentence }))
      : [{ path, data }],
  )
}

const tree = {
  lexemes: readJsonFiles(join(CONTENT_ROOT, 'lexemes')),
  sentences: [
    ...readJsonFiles(join(CONTENT_ROOT, 'sentences')),
    ...(includeDrafts ? readDrafts(join(CONTENT_ROOT, 'drafts')) : []),
  ],
  grammar: readJsonFiles(join(CONTENT_ROOT, 'grammar')),
}

const result = checkContent(tree)

if (result.warnings.length > 0) {
  console.warn(
    `content:check: ${result.warnings.length} warning(s) — gaps in the ending tables, not failures:\n`,
  )
  for (const warning of result.warnings) {
    console.warn(`  ${warning.file}\n    ${warning.message}`)
  }
  console.warn('')
}

if (result.ok) {
  const fileCount = tree.lexemes.length + tree.sentences.length + tree.grammar.length
  console.log(`content:check: ${fileCount} file(s) valid.`)
  process.exit(0)
}

console.error(`content:check: ${result.errors.length} error(s) found.\n`)
for (const error of result.errors) {
  console.error(`  ${error.file}\n    ${error.message}`)
}
process.exit(1)
