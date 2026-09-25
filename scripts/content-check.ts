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

const tree = {
  lexemes: readJsonFiles(join(CONTENT_ROOT, 'lexemes')),
  // content/drafts is intentionally excluded here too (ADR-006): content:check
  // validates published content, not work-in-progress drafts.
  sentences: readJsonFiles(join(CONTENT_ROOT, 'sentences')),
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
