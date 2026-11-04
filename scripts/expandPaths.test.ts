import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { expandPaths } from './expandPaths.js'

let cwd: string

beforeAll(() => {
  cwd = mkdtempSync(join(tmpdir(), 'expand-'))
  mkdirSync(join(cwd, 'content', 'lexemes'), { recursive: true })
  for (const name of ['lex_b.json', 'lex_a.json', 'notes.txt']) {
    writeFileSync(join(cwd, 'content', 'lexemes', name), '{}')
  }
})

describe('expandPaths', () => {
  it('expands a folder to its JSON files, sorted', () => {
    expect(expandPaths(['content/lexemes'], cwd)).toEqual([
      join('content', 'lexemes', 'lex_a.json'),
      join('content', 'lexemes', 'lex_b.json'),
    ])
  })

  it('expands a glob the shell left alone (PowerShell, cmd)', () => {
    expect(expandPaths(['content/lexemes/*.json'], cwd)).toEqual([
      join('content', 'lexemes', 'lex_a.json'),
      join('content', 'lexemes', 'lex_b.json'),
    ])
  })

  it('accepts absolute paths and drops duplicates', () => {
    const absolute = join(cwd, 'content', 'lexemes', 'lex_a.json')
    expect(expandPaths([absolute, 'content/lexemes/lex_a.json'], cwd)).toEqual([
      join('content', 'lexemes', 'lex_a.json'),
    ])
  })

  it('passes a path that matches nothing through, so it can be reported', () => {
    expect(expandPaths(['content/lexemes/nope.json', 'content/nope/*.json'], cwd)).toEqual([
      join('content', 'lexemes', 'nope.json'),
      join('content', 'nope', '*.json'),
    ])
  })
})
