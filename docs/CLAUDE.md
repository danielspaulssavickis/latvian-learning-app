# latvian-trainer

A small web app for learning Latvian. Unlike a generic flashcard app, it is built
around **inflectional morphology**: the core exercise is producing the correct
*form* of a word in context, not recalling an isolated translation.

Read `docs/SPEC.md` for the data model and exercise types.
Read `docs/ROADMAP.md` for what is done and what is next — update it as you go.
Read `docs/DECISIONS.md` before changing anything architectural.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # production build
npm run test         # Vitest, watch off in CI
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run content:check # validate every file in content/ against the Zod schemas + round-trip check
npm run content:check:drafts  # same, also checking content/drafts/ as if published
npm run content:approve -- <path>...  # human-only: approve lexemes, grammar files, draft sentences
npm run dev:drafts    # dev server with drafts visible (ADR-011); never in a build
```

Run `npm run typecheck && npm run test && npm run content:check` before saying a task is done.

## Stack

- Vite + React 18 + TypeScript (strict)
- Tailwind for styling; no component library
- IndexedDB via Dexie for user progress — no backend, no accounts (see ADR-002)
- `ts-fsrs` for review scheduling (see ADR-003)
- Zod for content validation
- Vitest + Testing Library; `fake-indexeddb` for `src/db/` tests

## Layout

```
src/
  engine/      # scheduling, answer checking, exercise generation — pure, no React
  content/     # loaders + Zod schemas
  ui/          # components and screens
  db/          # Dexie schema and queries
content/       # authored data: lexemes, sentences, grammar tables (JSON)
docs/          # SPEC, ROADMAP, DECISIONS
```

`src/engine/` must stay free of React imports and DOM access so it can be unit
tested directly. If a piece of logic needs a component to test, it is in the wrong place.

## Latvian content rules — read these carefully

1. **Draft sentences, never publish them yourself.** You may write candidate
   sentences into `content/drafts/*.json` — never directly into
   `content/sentences/`. A draft ships only after I run
   `npm run content:approve` and it passes (ADR-006/ADR-007). Grammar files
   in `content/grammar/` may be drafted too, always with `review: "draft"`
   (ADR-008) — list every cell you're unsure of in `content/_needed.json`
   instead of filling it. Lexemes may be drafted in `content/lexemes/` with
   `review: "draft"` (ADR-010); never set `review: "approved"` yourself —
   only `content:approve` does, and only the human runs it. Be most careful
   with case usage and verb government: that's exactly where a model
   produces plausible-looking errors, and wrong content teaches the user
   wrong Latvian. When unsure, add an entry to `content/_needed.json`
   instead of guessing, and say so. Generating *placeholder*
   content for tests is fine only under `src/**/__fixtures__/`.

2. **Diacritics are semantic.** `ā ē ī ū` are different letters from `a e i u`, and
   `ķ ģ ļ ņ š ž č` are distinct too. Never strip or fold them in `content/`.
   Normalize all stored text to Unicode NFC.

3. **Answer checking** (`src/engine/checkAnswer.ts`) compares NFC-normalized,
   case-folded, whitespace-trimmed strings. A missing diacritic is a *near miss*:
   accept the answer, mark it `nearMiss: true`, and show the correct spelling.
   Never silently accept it as fully correct.

4. **Grammar terminology** uses the English CEFR/linguistic names in code and UI:
   `nominative, genitive, dative, accusative, instrumental, locative, vocative`.
   Noun declension classes are numbered 1–6, verb conjugations 1–3.

5. **Exercise generation is data-driven.** Inflected forms come from the tables in
   `content/grammar/`, applied by `src/engine/inflect.ts`. Never hardcode a form
   inside a component. Never show a learner a form `inflect()` marks
   `confidence: "unverified"` as the expected answer (ADR-008).

6. **Annotations must round-trip.** Every annotated token whose part of speech
   `inflect()` supports must be reproducible from its lexeme and features;
   `content:check` fails otherwise, with sentence id, token index, expected and
   actual. When `inflect()` gains a part of speech, the check covers it
   automatically — expect new mismatches and sort tagging errors from table
   errors rather than loosening the check.

## Working style

- Use plan mode for anything touching more than two files. Show me the plan first.
- One milestone per session. When a milestone is done, tick it in `docs/ROADMAP.md`
  and commit.
- Write the test before the implementation for anything in `src/engine/`.
- Conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- Do not add a dependency without telling me what it replaces and why. Do not add
  a state management library; React state and Dexie live queries are enough.
- If you make a decision that a future session would need to know about, append it
  to `docs/DECISIONS.md` as a new ADR rather than leaving it in the chat.

## Out of scope (do not build these unprompted)

Accounts, sync, a backend, a native mobile app (it's an installable PWA — ADR-013),
social features, gamified streaks, AI-generated content at runtime, or a paid tier. If you think one is needed,
say so and wait.
