#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import {
  buildApproveContext,
  buildApprovedGrammarFile,
  buildApprovedLexeme,
  buildApprovedSentence,
  buildApprovedSentences,
  type ContentFile,
} from '../src/content/validate.js'
import type { Sentence } from '../src/content/schemas.js'

/**
 * Human-only (ADR-006, ADR-008, ADR-010). Accepts any number of paths:
 *
 *   content/lexemes/<id>.json   approved in place
 *   content/grammar/<file>.json approved in place
 *   content/drafts/<file>.json  validated, then moved into content/sentences/
 *
 * Lexemes and grammar files are processed first, so one command can approve
 * a batch of sentences together with the lexemes they need.
 */

const CONTENT_ROOT = join(process.cwd(), 'content')
const paths = process.argv.slice(2)

if (paths.length === 0) {
  console.error('Usage: npm run content:approve -- <path> [<path> ...]')
  console.error('  paths under content/lexemes/, content/grammar/ or content/drafts/')
  process.exit(1)
}

function under(dir: string, absolute: string): boolean {
  return relative(join(CONTENT_ROOT, dir), absolute).split(sep)[0] !== '..'
}

function readJson(absolute: string): unknown {
  return JSON.parse(readFileSync(absolute, 'utf-8'))
}

function writeJson(absolute: string, data: unknown): void {
  writeFileSync(absolute, `${JSON.stringify(data, null, 2)}\n`)
}

function readDir(dir: string): ContentFile[] {
  const absolute = join(CONTENT_ROOT, dir)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ path: name, data: readJson(join(absolute, name)) }))
}

let failures = 0
const now = new Date()
const resolved = paths.map((path) => ({ path, absolute: join(process.cwd(), path) }))
const inPlace = resolved.filter(
  ({ absolute }) => under('lexemes', absolute) || under('grammar', absolute),
)
const drafts = resolved.filter(({ absolute }) => under('drafts', absolute))
const other = resolved.filter((entry) => !inPlace.includes(entry) && !drafts.includes(entry))

for (const { path } of other) {
  console.error(
    `content:approve: ${path} is not under content/lexemes, content/grammar or content/drafts`,
  )
  failures += 1
}

for (const { path, absolute } of inPlace) {
  if (!existsSync(absolute)) {
    console.error(`content:approve: no such file: ${path}`)
    failures += 1
    continue
  }
  const raw = readJson(absolute)
  const result = under('lexemes', absolute)
    ? buildApprovedLexeme(raw, now)
    : buildApprovedGrammarFile(raw, now)
  if (!result.ok) {
    console.error(`content:approve: ${path} failed validation, not changed:`)
    for (const error of result.errors) console.error(`    ${error.message}`)
    failures += 1
    continue
  }
  writeJson(absolute, 'lexeme' in result ? result.lexeme : result.file)
  console.log(`content:approve: approved ${path} in place`)
}

/** Writes an approved sentence, refusing to overwrite an existing published file. */
function writeApproved(sentence: Sentence): boolean {
  const destination = join(CONTENT_ROOT, 'sentences', `${sentence.id}.json`)
  const shown = relative(process.cwd(), destination)
  if (existsSync(destination)) {
    console.error(`content:approve: ${sentence.id}: refusing to overwrite existing ${shown}`)
    return false
  }
  writeJson(destination, sentence)
  console.log(`content:approve: approved ${sentence.id} -> ${shown}`)
  return true
}

if (drafts.length > 0) {
  // Read after the in-place approvals above, so lexemes approved in this run count.
  const context = buildApproveContext({ lexemes: readDir('lexemes'), grammar: readDir('grammar') })

  for (const { path, absolute } of drafts) {
    if (!existsSync(absolute)) {
      console.error(`content:approve: no such file: ${path}`)
      failures += 1
      continue
    }
    const raw = readJson(absolute)

    if (!Array.isArray(raw)) {
      const result = buildApprovedSentence(raw, context, now)
      if (!result.ok) {
        console.error(`content:approve: ${path} failed validation, no files changed:`)
        for (const error of result.errors) console.error(`    ${error.message}`)
        failures += 1
        continue
      }
      if (writeApproved(result.sentence)) rmSync(absolute)
      else failures += 1
      continue
    }

    const stillFailing: unknown[] = []
    for (const result of buildApprovedSentences(raw, context, now)) {
      if (!result.ok) {
        stillFailing.push(result.raw)
        console.error(`content:approve: ${result.id} failed validation:`)
        for (const error of result.errors) console.error(`    ${error.message}`)
        continue
      }
      if (!writeApproved(result.sentence)) stillFailing.push(result.sentence)
    }

    if (stillFailing.length === 0) {
      rmSync(absolute)
      console.log(`content:approve: approved all ${raw.length} sentence(s) from ${path}.`)
    } else {
      writeJson(absolute, stillFailing)
      failures += stillFailing.length
      console.error(
        `content:approve: ${stillFailing.length}/${raw.length} not approved; ${path} now contains only those.`,
      )
    }
  }
}

process.exit(failures === 0 ? 0 : 1)
