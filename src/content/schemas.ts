import { z } from 'zod'

/**
 * Diacritics are semantic (CLAUDE.md rule 2): every human-authored string in
 * content/ must already be Unicode-NFC-normalized, never a decomposed form.
 */
function isNFC(value: string): boolean {
  return value === value.normalize('NFC')
}

function nfcString(message: string) {
  return z.string().min(1).refine(isNFC, message)
}

export const posSchema = z.enum([
  'noun',
  'verb',
  'adjective',
  'pronoun',
  'adverb',
  'preposition',
  'conjunction',
  'particle',
  'numeral',
  'interjection',
])

export const caseSchema = z.enum(['nom', 'gen', 'dat', 'acc', 'ins', 'loc', 'voc'])
export const numberSchema = z.enum(['sg', 'pl'])
export const genderSchema = z.enum(['m', 'f'])
export const tenseSchema = z.enum(['pres', 'past', 'fut'])
export const personSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])
/**
 * Provisional: debitive ("must/have to") is a real, distinct Latvian mood,
 * not a tense. Its interaction with tense (e.g. present vs. past debitive)
 * is real linguistic design that belongs to M2's src/engine/inflect.ts —
 * this is just enough schema surface to tag it, see content/_needed.json.
 */
export const moodSchema = z.enum(['indicative', 'debitive'])
export const declensionSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
])
export const conjugationSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])
export const levelSchema = z.enum(['a1', 'a2', 'b1'])

/**
 * A token's grammatical features. Uninflected words (prepositions, adverbs, a
 * bare numeral) legitimately have none of these — whether that's acceptable
 * depends on whether the token is drillable, so that check lives on
 * tokenSchema below, not here.
 */
export const featuresSchema = z.strictObject({
  case: caseSchema.optional(),
  number: numberSchema.optional(),
  gender: genderSchema.optional(),
  tense: tenseSchema.optional(),
  person: personSchema.optional(),
  mood: moodSchema.optional(),
  definiteness: z.enum(['definite', 'indefinite']).optional(),
})

export const tokenSchema = z
  .strictObject({
    surface: nfcString('token surface is not NFC-normalized'),
    lexeme: z.string().min(1),
    features: featuresSchema,
    drillable: z.boolean().optional(),
  })
  .refine(
    (token) => !token.drillable || Object.keys(token.features).length > 0,
    {
      message: 'a drillable token must have at least one grammatical feature',
      path: ['features'],
    },
  )

export const lexemeSchema = z.strictObject({
  id: z.string().min(1),
  lemma: nfcString('lemma is not NFC-normalized'),
  pos: posSchema,
  gender: genderSchema.nullable(),
  declension: declensionSchema.nullable(),
  conjugation: conjugationSchema.nullable(),
  gloss: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string()).default([]),
  irregular: z.record(z.string(), z.string()).optional(),
})

/**
 * Loosely shaped on purpose: SPEC.md only describes grammar tables as "ending
 * tables, keyed by class and form." The real structure gets nailed down in
 * Session 2 (M2, src/engine/inflect.ts) once real linguistic data exists —
 * this is enough to validate that a grammar table file is well-formed JSON
 * data, not a claim about the final shape.
 */
export const grammarTableSchema = z.strictObject({
  id: z.string().min(1),
  pos: posSchema,
  class: z.number().int().positive(),
  endings: z.record(z.string(), z.record(z.string(), z.string())),
})

export const sentenceBaseSchema = z
  .strictObject({
    id: z.string().min(1),
    text: nfcString('text is not NFC-normalized'),
    gloss: nfcString('gloss is not NFC-normalized'),
    level: levelSchema,
    tokens: z.array(tokenSchema).min(1),
    audio: z.string().optional(),
    // Set only by `npm run content:approve` (ADR-006) — never authored by hand.
    review: z.enum(['draft', 'approved']).optional(),
    reviewedAt: z.string().datetime().optional(),
    // Provenance audit trail (ADR-007): was this drafted by Claude or a human?
    source: z.enum(['generated', 'human']).optional(),
  })
  .refine((sentence) => sentence.tokens.some((token) => token.drillable === true), {
    message: 'sentence must have at least one drillable token',
    path: ['tokens'],
  })

export type Lexeme = z.infer<typeof lexemeSchema>
export type GrammarTable = z.infer<typeof grammarTableSchema>
export type Sentence = z.infer<typeof sentenceBaseSchema>
export type Token = z.infer<typeof tokenSchema>

/**
 * A sentence schema bound to the set of lexeme ids known to exist, so that a
 * token referencing an unknown lexeme fails validation with a useful message.
 * This can't be a module-level constant because the valid id set depends on
 * what else is loaded — see src/content/validate.ts and src/content/loader.ts.
 */
export function makeSentenceSchema(validLexemeIds: ReadonlySet<string>) {
  return sentenceBaseSchema.superRefine((sentence, ctx) => {
    sentence.tokens.forEach((token, index) => {
      if (!validLexemeIds.has(token.lexeme)) {
        ctx.addIssue({
          code: 'custom',
          message: `token ${index} references unknown lexeme id "${token.lexeme}"`,
          path: ['tokens', index, 'lexeme'],
        })
      }
    })
  })
}
