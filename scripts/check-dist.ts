#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Runs after `vite build` (ADR-011): fails if any draft sentence's text made
 * it into dist/ — i.e. if the dev-only draft preview leaked into production.
 */
const dist = join(process.cwd(), 'dist')
const draftsDir = join(process.cwd(), 'content', 'drafts')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

function asciiEscaped(text: string): string {
  return text.replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

const needles: string[] = []
if (existsSync(draftsDir)) {
  for (const name of readdirSync(draftsDir).filter((n) => n.endsWith('.json'))) {
    const data: unknown = JSON.parse(readFileSync(join(draftsDir, name), 'utf-8'))
    for (const sentence of Array.isArray(data) ? data : [data]) {
      const text = (sentence as { text?: unknown }).text
      if (typeof text === 'string') needles.push(text)
    }
  }
}

const leaks: string[] = []
for (const path of files(dist)) {
  const body = readFileSync(path, 'utf-8')
  for (const text of needles) {
    if (body.includes(text) || body.toLowerCase().includes(asciiEscaped(text).toLowerCase())) {
      leaks.push(`${path.slice(process.cwd().length + 1)}: "${text}"`)
    }
  }
}

if (leaks.length > 0) {
  console.error('check-dist: draft content leaked into the production build (ADR-011):')
  for (const leak of leaks) console.error(`  ${leak}`)
  process.exit(1)
}
console.log(`check-dist: no draft sentences in dist/ (${needles.length} checked).`)
