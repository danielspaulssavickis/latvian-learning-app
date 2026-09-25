#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Runs after `vite build` (ADR-011): fails if any draft sentence made it into
 * dist/ — i.e. if the dev-only draft preview leaked into production. Matches
 * on sentence ids rather than text, because lexeme notes may quote an
 * example sentence verbatim. An id that is also published in
 * content/sentences/ is skipped.
 */
const dist = join(process.cwd(), 'dist')
const draftsDir = join(process.cwd(), 'content', 'drafts')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

/** Minifiers may emit a string with single quotes or backticks instead. */
function singleQuoted(quoted: string): string {
  return `'${quoted.slice(1, -1)}'`
}

const sentencesDir = join(process.cwd(), 'content', 'sentences')
const published = new Set(
  existsSync(sentencesDir)
    ? readdirSync(sentencesDir).map((name) => name.replace(/\.json$/, ''))
    : [],
)

const needles: string[] = []
if (existsSync(draftsDir)) {
  for (const name of readdirSync(draftsDir).filter((n) => n.endsWith('.json'))) {
    const data: unknown = JSON.parse(readFileSync(join(draftsDir, name), 'utf-8'))
    for (const sentence of Array.isArray(data) ? data : [data]) {
      const id = (sentence as { id?: unknown }).id
      if (typeof id === 'string' && !published.has(id)) needles.push(`"${id}"`)
    }
  }
}

const leaks: string[] = []
for (const path of files(dist)) {
  const body = readFileSync(path, 'utf-8')
  for (const text of needles) {
    // e.g. "snt_0011" or 'snt_0011'
    if (body.includes(text) || body.includes(singleQuoted(text))) {
      leaks.push(`${path.slice(process.cwd().length + 1)}: ${text}`)
    }
  }
}

if (leaks.length > 0) {
  console.error('check-dist: draft content leaked into the production build (ADR-011):')
  for (const leak of leaks) console.error(`  ${leak}`)
  process.exit(1)
}
console.log(`check-dist: no draft sentences in dist/ (${needles.length} ids checked).`)
