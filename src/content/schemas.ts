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

/** A noun form key, e.g. "gen.sg" — used by ending tables, alternations and `irregular`. */
export const formKeySchema = z.templateLiteral([caseSchema, '.', numberSchema])

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
  .refine((token) => !token.drillable || Object.keys(token.features).length > 0, {
    message: 'a drillable token must have at least one grammatical feature',
    path: ['features'],
  })

export const lexemeSchema = z
  .strictObject({
    id: z.string().min(1),
    lemma: nfcString('lemma is not NFC-normalized'),
    pos: posSchema,
    gender: genderSchema.nullable(),
    declension: declensionSchema.nullable(),
    conjugation: conjugationSchema.nullable(),
    gloss: z.array(z.string().min(1)).min(1),
    tags: z.array(z.string()).default([]),
    /**
     * Hand-authored forms that override the generated one (ADR-004). For nouns
     * the key is a form key like "gen.sg"; other parts of speech get their key
     * format when the engine supports them.
     */
    irregular: z.record(z.string(), nfcString('irregular form is not NFC-normalized')).optional(),
  })
  .superRefine((lexeme, ctx) => {
    if (lexeme.pos !== 'noun' || !lexeme.irregular) return
    for (const key of Object.keys(lexeme.irregular)) {
      if (!formKeySchema.safeParse(key).success) {
        ctx.addIssue({
          code: 'custom',
          message: `irregular key "${key}" is not a noun form key like "gen.sg"`,
          path: ['irregular', key],
        })
      }
    }
  })

/**
 * Review metadata shared by every file with a draft/approved gate: sentences
 * (ADR-006, gated by directory) and grammar files (ADR-008, gated by this
 * field). `review`/`reviewedAt` are set only by `npm run content:approve`,
 * never authored by hand; `source` is provenance (ADR-007).
 */
const reviewFields = {
  review: z.enum(['draft', 'approved']).optional(),
  reviewedAt: z.string().datetime().optional(),
  source: z.enum(['generated', 'human']).optional(),
}

// An ending may be "" (a zero ending), so this is not nfcString().
const endingSchema = z.string().refine(isNFC, 'ending is not NFC-normalized')
const caseEndingsSchema = z.partialRecord(caseSchema, endingSchema)

/**
 * One noun declension's ending table (ADR-008). `inflect()` strips the longest
 * matching `lemmaEndings` entry from the lemma to get the stem, then appends
 * the cell for the requested case and number. A missing cell is a *gap* —
 * reported, never guessed. `gender: null` covers every gender in the
 * declension; a gender-specific table for the same declension wins over it.
 */
export const nounEndingTableSchema = z.strictObject({
  kind: z.literal('noun-endings'),
  id: z.string().min(1),
  declension: declensionSchema,
  gender: genderSchema.nullable(),
  lemmaEndings: z.array(nfcString('lemma ending is not NFC-normalized')).min(1),
  endings: z.strictObject({ sg: caseEndingsSchema, pl: caseEndingsSchema }),
  notes: z.array(z.string()).optional(),
  ...reviewFields,
})

/**
 * Consonant alternation (the palatalization in declensions 2, 5 and 6), as an
 * explicit rule list rather than regex guessing (SPEC.md). `appliesTo` says
 * which forms of which declension alternate; `rules` rewrite the end of the
 * stem, longest `from` first. An identity rule (`from` === `to`) blocks a
 * shorter rule, e.g. "st" → "st" stops "t" → "š" from firing.
 */
export const alternationsSchema = z.strictObject({
  kind: z.literal('alternations'),
  id: z.string().min(1),
  appliesTo: z.array(
    z.strictObject({ declension: declensionSchema, forms: z.array(formKeySchema).min(1) }),
  ),
  rules: z
    .array(
      z.strictObject({
        from: nfcString('alternation "from" is not NFC-normalized'),
        to: nfcString('alternation "to" is not NFC-normalized'),
      }),
    )
    .min(1),
  notes: z.array(z.string()).optional(),
  ...reviewFields,
})

export const grammarFileSchema = z.discriminatedUnion('kind', [
  nounEndingTableSchema,
  alternationsSchema,
])

export const sentenceBaseSchema = z
  .strictObject({
    id: z.string().min(1),
    text: nfcString('text is not NFC-normalized'),
    gloss: nfcString('gloss is not NFC-normalized'),
    level: levelSchema,
    tokens: z.array(tokenSchema).min(1),
    audio: z.string().optional(),
    ...reviewFields,
  })
  .refine((sentence) => sentence.tokens.some((token) => token.drillable === true), {
    message: 'sentence must have at least one drillable token',
    path: ['tokens'],
  })

export type Lexeme = z.infer<typeof lexemeSchema>
export type NounEndingTable = z.infer<typeof nounEndingTableSchema>
export type AlternationsFile = z.infer<typeof alternationsSchema>
export type GrammarFile = z.infer<typeof grammarFileSchema>
export type Features = z.infer<typeof featuresSchema>
export type FormKey = z.infer<typeof formKeySchema>
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
