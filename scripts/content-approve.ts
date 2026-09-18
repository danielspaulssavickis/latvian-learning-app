#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildApprovedSentence } from '../src/content/validate.js'

const CONTENT_ROOT = join(process.cwd(), 'content')
const draftPath = process.argv[2]

if (!draftPath) {
  console.error('Usage: npm run content:approve -- content/drafts/<file>.json')
  process.exit(1)
}

const absoluteDraftPath = join(process.cwd(), draftPath)
if (!existsSync(absoluteDraftPath)) {
  console.error(`content:approve: no such file: ${draftPath}`)
  process.exit(1)
}

function loadLexemeIds(): Set<string> {
  const dir = join(CONTENT_ROOT, 'lexemes')
  if (!existsSync(dir)) return new Set()
  const ids = new Set<string>()
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    const data = JSON.parse(readFileSync(join(dir, name), 'utf-8')) as { id?: unknown }
    if (typeof data.id === 'string') ids.add(data.id)
  }
  return ids
}

const raw: unknown = JSON.parse(readFileSync(absoluteDraftPath, 'utf-8'))
const result = buildApprovedSentence(raw, loadLexemeIds(), new Date())

if (!result.ok) {
  console.error(`content:approve: ${draftPath} failed validation, no files changed.\n`)
  for (const error of result.errors) {
    console.error(`    ${error.message}`)
  }
  process.exit(1)
}

const destination = join(CONTENT_ROOT, 'sentences', `${result.sentence.id}.json`)
if (existsSync(destination)) {
  console.error(
    `content:approve: refusing to overwrite existing file at ${destination.slice(process.cwd().length + 1)}`,
  )
  process.exit(1)
}

writeFileSync(destination, `${JSON.stringify(result.sentence, null, 2)}\n`)
rmSync(absoluteDraftPath)
console.log(`content:approve: approved ${result.sentence.id} -> ${destination.slice(process.cwd().length + 1)}`)
