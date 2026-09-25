#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import {
  buildApprovedGrammarFile,
  buildApprovedSentence,
  buildApprovedSentences,
} from '../src/content/validate.js'
import type { Sentence } from '../src/content/schemas.js'

const CONTENT_ROOT = join(process.cwd(), 'content')
const draftPath = process.argv[2]

if (!draftPath) {
  console.error('Usage: npm run content:approve -- content/drafts/<file>.json')
  console.error('       npm run content:approve -- content/grammar/<file>.json')
  process.exit(1)
}

const absoluteDraftPath = join(process.cwd(), draftPath)
if (!existsSync(absoluteDraftPath)) {
  console.error(`content:approve: no such file: ${draftPath}`)
  process.exit(1)
}

// Grammar files (ADR-008) are approved in place: the `review` field, not the
// directory, is what inflect() honors. Sentences move out of drafts/ instead.
const grammarDir = join(CONTENT_ROOT, 'grammar')
if (relative(grammarDir, absoluteDraftPath).split(sep)[0] !== '..') {
  const result = buildApprovedGrammarFile(
    JSON.parse(readFileSync(absoluteDraftPath, 'utf-8')),
    new Date(),
  )
  if (!result.ok) {
    console.error(`content:approve: ${draftPath} failed validation, no files changed.\n`)
    for (const error of result.errors) console.error(`    ${error.message}`)
    process.exit(1)
  }
  writeFileSync(absoluteDraftPath, `${JSON.stringify(result.file, null, 2)}\n`)
  console.log(`content:approve: approved grammar file ${result.file.id} in place (${draftPath}).`)
  process.exit(0)
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

/** Writes an approved sentence, refusing to overwrite an existing published file. */
function writeApproved(sentence: Sentence): { ok: true } | { ok: false; message: string } {
  const destination = join(CONTENT_ROOT, 'sentences', `${sentence.id}.json`)
  if (existsSync(destination)) {
    return {
      ok: false,
      message: `refusing to overwrite existing file at ${destination.slice(process.cwd().length + 1)}`,
    }
  }
  writeFileSync(destination, `${JSON.stringify(sentence, null, 2)}\n`)
  console.log(
    `content:approve: approved ${sentence.id} -> ${destination.slice(process.cwd().length + 1)}`,
  )
  return { ok: true }
}

const raw: unknown = JSON.parse(readFileSync(absoluteDraftPath, 'utf-8'))
const lexemeIds = loadLexemeIds()
const now = new Date()

if (Array.isArray(raw)) {
  const results = buildApprovedSentences(raw, lexemeIds, now)
  const stillFailing: unknown[] = []
  let failureCount = 0

  for (const result of results) {
    if (!result.ok) {
      stillFailing.push(result.raw)
      failureCount += 1
      console.error(`content:approve: ${result.id} failed validation:`)
      for (const error of result.errors) console.error(`    ${error.message}`)
      continue
    }
    const written = writeApproved(result.sentence)
    if (!written.ok) {
      stillFailing.push(result.sentence)
      failureCount += 1
      console.error(`content:approve: ${result.id} ${written.message}`)
    }
  }

  if (failureCount === 0) {
    rmSync(absoluteDraftPath)
    console.log(`content:approve: approved all ${results.length} sentence(s) from ${draftPath}.`)
    process.exit(0)
  }

  writeFileSync(absoluteDraftPath, `${JSON.stringify(stillFailing, null, 2)}\n`)
  console.error(
    `\ncontent:approve: ${failureCount}/${results.length} failed, ${results.length - failureCount} approved. ${draftPath} now contains only what still needs fixing.`,
  )
  process.exit(1)
}

const result = buildApprovedSentence(raw, lexemeIds, now)

if (!result.ok) {
  console.error(`content:approve: ${draftPath} failed validation, no files changed.\n`)
  for (const error of result.errors) {
    console.error(`    ${error.message}`)
  }
  process.exit(1)
}

const written = writeApproved(result.sentence)
if (!written.ok) {
  console.error(`content:approve: ${written.message}`)
  process.exit(1)
}
rmSync(absoluteDraftPath)
