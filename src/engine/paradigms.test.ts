import { describe, expect, it } from 'vitest'
import { grammarFileSchema } from '../content/schemas'
import { NOUN_FIXTURES } from './__fixtures__/nouns'
import { buildGrammar, inflect } from './inflect'

/**
 * Table-driven: every fixture noun's full paradigm, generated from the *real*
 * ending tables and alternation rules in content/grammar/ — so this test fails
 * if a table cell is wrong, not just if the engine is.
 */
const modules = import.meta.glob('../../content/grammar/*.json', { eager: true })
const grammar = buildGrammar(
  Object.values(modules).map((module) =>
    grammarFileSchema.parse((module as { default: unknown }).default),
  ),
)

const CASES = ['nom', 'gen', 'dat', 'acc', 'ins', 'loc', 'voc'] as const
const NUMBERS = ['sg', 'pl'] as const

describe.each([1, 2, 3, 4, 5, 6] as const)('declension %i full paradigms', (declension) => {
  const fixtures = NOUN_FIXTURES[declension]

  it('has at least five fixture nouns', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(5)
  })

  describe.each(fixtures.map((f) => [f.lexeme.lemma, f] as const))('%s', (_lemma, fixture) => {
    for (const number of NUMBERS) {
      for (const grammaticalCase of CASES) {
        const key = `${grammaticalCase}.${number}`
        const expected = fixture.forms[key]
        it(`${key} → ${expected ?? '(gap)'}`, () => {
          const result = inflect(fixture.lexeme, { case: grammaticalCase, number }, grammar)
          if (expected === undefined) {
            expect(result).toMatchObject({ ok: false, reason: 'gap' })
          } else {
            expect(result).toMatchObject({ ok: true, form: expected })
          }
        })
      }
    }
  })
})
