# ROADMAP

**This file is the shared state between sessions.** Claude: tick boxes as work
lands, add a dated line under "Session log", and keep "Current focus" accurate.
Do not rewrite finished milestones; append.

**Current focus:** M0 — repo skeleton

---

## M0 — Skeleton

- [ ] Vite + React + TS (strict) scaffold, Tailwind configured
- [ ] Vitest + Testing Library wired, one passing smoke test
- [ ] ESLint + Prettier, `npm run typecheck`/`lint`/`test` scripts
- [ ] Directory layout from CLAUDE.md created, with a README in each of `src/engine/`, `content/`
- [ ] `.gitignore`, initial commit, GitHub repo

**Done when:** `npm run dev` serves a blank styled page and all three check
commands pass on a clean clone.

## M1 — Content pipeline

- [ ] Zod schemas for Lexeme, Sentence, GrammarTable (`src/content/schemas.ts`)
- [ ] `npm run content:check` validates every file in `content/` and fails loudly with the offending path
- [ ] Loader that builds an in-memory index: lexeme by id, sentences by level, sentences by feature
- [ ] `content/_needed.json` convention for missing content
- [ ] 20 hand-authored A1 sentences as the seed set (I write these, not you)

**Done when:** `content:check` catches a deliberately broken fixture, and the
loader has tests covering a missing lexeme reference and a token with no features.

## M2 — Inflection engine

- [ ] `inflect(lexeme, features)` for nouns, declensions 1–6, sg + pl, all 7 cases
- [ ] `irregular` overrides take precedence
- [ ] Consonant alternation rules from `content/grammar/alternations.json`
- [ ] Table-driven tests: at least 5 nouns per declension class, full paradigm
- [ ] `checkAnswer` with the correct / nearMiss / wrong contract from SPEC.md

**Done when:** the full paradigm tests pass and `checkAnswer("Rīgā", "Riga")`
returns `nearMiss` while `checkAnswer("Rīgā", "Rīgu")` returns `wrong`.

## M3 — Review loop

- [ ] Dexie schema for cards + review log; deterministic card generation from content
- [ ] `ts-fsrs` integration in `src/engine/schedule.ts`, injectable clock
- [ ] Cloze review screen: keyboard-first, Enter to submit, Enter again to advance
- [ ] Latvian diacritic input helper (clickable `ā ē ī ū ķ ģ ļ ņ š ž č` row + a dead-key hint)
- [ ] Session summary screen
- [ ] Daily new/review caps, configurable

**Done when:** I can do a full 20-card session, close the tab, reopen it, and the
scheduling state has survived.

## M4 — More exercise types + progress

- [ ] `inflect`, `produce`, `recognize` exercise kinds
- [ ] Per-feature retention tracking over trailing 30 reviews
- [ ] Dashboard: weak features surfaced, sorted worst-first
- [ ] JSON export/import of progress

**Done when:** the dashboard correctly identifies a feature I've deliberately
failed ten times in a row.

## M5 — Audio + polish

- [ ] Audio playback for sentences that have a file; graceful absence otherwise
- [ ] `listen` exercise kind
- [ ] Responsive layout, works on a phone
- [ ] Deploy (static host), basic error boundary
- [ ] Decide and document the audio source (see ADR-005 open question)

**Done when:** deployed, usable on my phone, and a missing audio file degrades to
a text-only card instead of breaking the session.

---

## Session log

<!-- newest first, one line each: date — what landed — what to pick up next -->
