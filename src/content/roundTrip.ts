import { inflect, type Grammar } from '../engine/inflect.js'
import type { Lexeme, Sentence, Token } from './schemas.js'

export interface RoundTripFinding {
  /**
   * `mismatch`: the engine produced a different form, or the tagging is
   * incomplete — an error. `gap`: the engine couldn't produce a form at all
   * (missing table cell, no table) — a warning, since nothing contradicts
   * the annotation.
   */
  kind: 'mismatch' | 'gap'
  sentenceId: string
  tokenIndex: number
  expected: string
  actual?: string
  message: string
}

function fold(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase('lv')
}

function describeToken(token: Token): string {
  const features = Object.entries(token.features)
    .map(([key, value]) => `${key}:${value}`)
    .join(' ')
  return `("${token.surface}", ${token.lexeme} ${features})`
}

/**
 * The round-trip annotation check (CLAUDE.md rule 6): every annotated token
 * whose part of speech `inflect()` supports must be reproducible from its
 * lexeme and features. Capitalization is ignored — it isn't morphology.
 *
 * Tokens the engine can't inflect yet (non-nouns in M2) and feature-less
 * tokens are skipped, not reported. Each mismatch says whether the generated
 * form came from reviewed data, so a tagging error can be told apart from a
 * wrong ending in a draft table.
 */
export function checkRoundTrip(
  sentences: readonly Sentence[],
  lexemeById: ReadonlyMap<string, Lexeme>,
  grammar: Grammar,
): RoundTripFinding[] {
  const findings: RoundTripFinding[] = []

  for (const sentence of sentences) {
    sentence.tokens.forEach((token, tokenIndex) => {
      const lexeme = lexemeById.get(token.lexeme)
      if (!lexeme || Object.keys(token.features).length === 0) return

      const result = inflect(lexeme, token.features, grammar)
      const where = `${sentence.id} token ${tokenIndex} ${describeToken(token)}`
      const base = { sentenceId: sentence.id, tokenIndex, expected: token.surface }

      if (!result.ok) {
        if (result.reason === 'unsupported-pos') return
        if (result.reason === 'missing-features') {
          findings.push({
            ...base,
            kind: 'mismatch',
            message: `${where}: a ${lexeme.pos} token needs both case and number to be checked`,
          })
          return
        }
        findings.push({
          ...base,
          kind: 'gap',
          message: `${where}: cannot check — ${result.message}`,
        })
        return
      }

      if (fold(result.form) === fold(token.surface)) return

      const hint =
        result.confidence === 'verified'
          ? 'generated from reviewed data, so the tagging is the likely error'
          : 'generated from unverified (draft) grammar data, so the table may be wrong rather than the tagging'
      findings.push({
        ...base,
        kind: 'mismatch',
        actual: result.form,
        message: `${where}: expected "${token.surface}", got "${result.form}" — ${hint}`,
      })
    })
  }

  return findings
}
