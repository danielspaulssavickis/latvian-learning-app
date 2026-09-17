# SPEC — latvian-trainer

## The problem this app solves

Generic flashcard apps teach `māja → house`. That is close to useless for Latvian,
because the learner then cannot say "at home", "to the house", or "of the houses" —
seven cases across six declension classes, with adjectives agreeing in gender,
number, case and definiteness.

So the app's core loop is not *recall a translation*. It is **produce the correct
form of a known word inside a sentence**, scheduled by spaced repetition, with the
grammatical feature being drilled tracked explicitly so progress can be measured
per case, per tense, per declension class.

Target user: an adult beginner (A1) working toward A2/B1 for daily life in Latvia.

## Data model

All content lives in `content/` as JSON, validated by Zod schemas in
`src/content/schemas.ts`. IDs are stable strings; never renumber them.

### Lexeme — `content/lexemes/*.json`

```ts
{
  id: "lex_maja",
  lemma: "māja",
  pos: "noun",
  gender: "f",              // "m" | "f" | null (for non-nouns)
  declension: 4,            // 1–6 for nouns; null otherwise
  conjugation: null,        // 1–3 for verbs; null otherwise
  gloss: ["house", "home"],
  tags: ["a1", "living"],
  irregular?: { [formKey: string]: string }   // overrides the generated form
}
```

### Grammar table — `content/grammar/*.json`

Ending tables, keyed by class and form. `inflect(lexeme, features)` in
`src/engine/inflect.ts` applies these, checks `irregular` first, and returns
`{ form, confidence }`. Consonant alternation in the genitive (the
palatalization that hits declensions 2 and 5) is handled by an explicit rule
list in `content/grammar/alternations.json`, not by regex guessing.

### Sentence — `content/sentences/*.json`

```ts
{
  id: "snt_0142",
  text: "Es dzīvoju Rīgā.",
  gloss: "I live in Riga.",
  level: "a1",
  tokens: [
    { surface: "Es",      lexeme: "lex_es",    features: { case: "nom", number: "sg" } },
    { surface: "dzīvoju", lexeme: "lex_dzivot", features: { tense: "pres", person: 1, number: "sg" } },
    { surface: "Rīgā",    lexeme: "lex_riga",  features: { case: "loc", number: "sg" }, drillable: true }
  ],
  audio?: "audio/snt_0142.mp3"
}
```

`drillable: true` marks a token the exercise generator may blank out. Every
sentence needs at least one. Token alignment is what makes the whole app work —
it is worth authoring carefully.

### Card / review state — IndexedDB, not in `content/`

```ts
{
  id, kind, targetId,           // e.g. kind: "cloze", targetId: "snt_0142#2"
  feature: "case:loc",          // what this card actually drills
  fsrs: { stability, difficulty, due, reps, lapses, state }
}
```

One card per *drillable feature instance*, not per sentence. The same sentence can
produce several cards. Cards are generated deterministically from content so that
adding content never orphans a user's history.

## Exercise types

| Kind | Prompt | Answer | Milestone |
|---|---|---|---|
| `cloze` | Sentence with one token blanked, lemma shown in brackets | typed form | M2 |
| `recognize` | Latvian sentence | English gloss, multiple choice | M2 |
| `produce` | English gloss | typed Latvian sentence | M3 |
| `inflect` | Lemma + target features ("māja, locative singular") | typed form | M3 |
| `listen` | Audio only | typed sentence | M5 |

`cloze` is the primary type. It is deliberately the one that teaches endings as a
reflex, which is the thing a declension chart cannot do.

## Answer checking

`checkAnswer(expected, given)` returns `"correct" | "nearMiss" | "wrong"`.

- Normalize both to NFC, trim, collapse internal whitespace, case-fold.
- Exact match → `correct`.
- Match after folding diacritics on **both** sides → `nearMiss`. Show a diff
  highlighting the missing macron or softened consonant. Feed `nearMiss` to FSRS
  as a "hard" grade, not as a failure.
- Everything else → `wrong`.

Do not use edit distance for anything else. A one-letter difference in Latvian is
usually a different case, not a typo, and forgiving it defeats the purpose.

## Scheduling

FSRS via `ts-fsrs`, four grades (again / hard / good / easy) mapped from the
check result plus response time. New cards are introduced in content order,
capped at a configurable daily limit (default 10 new, 100 reviews). All
scheduling logic stays in `src/engine/schedule.ts` and is unit tested against
fixed clock values — never `Date.now()` inside the engine.

## Progress model

Per grammatical feature (`case:loc`, `tense:past`, `declension:2`), track
retention over the last 30 reviews. The dashboard shows which features are weak.
This is the feature that makes the app worth building rather than downloading
something existing: the learner can see that their locative is solid and their
genitive is not.

## Explicit non-goals

No speech recognition. No AI-generated content at runtime. No accounts or sync —
progress lives in the browser, with JSON export/import as the backup path. No
attempt to cover C-level grammar (participles, aspect subtleties, the vocative
beyond a fixed phrase list).
