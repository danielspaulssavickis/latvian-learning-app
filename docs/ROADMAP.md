# ROADMAP

**This file is the shared state between sessions.** Claude: tick boxes as work
lands, add a dated line under "Session log", and keep "Current focus" accurate.
Do not rewrite finished milestones; append.

**Current focus:** see the newest session log line.

---

## M0 — Skeleton

- [x] Vite + React + TS (strict) scaffold, Tailwind configured
- [x] Vitest + Testing Library wired, one passing smoke test
- [x] ESLint + Prettier, `npm run typecheck`/`lint`/`test` scripts
- [x] Directory layout from CLAUDE.md created, with a README in each of `src/engine/`, `content/`
- [x] `.gitignore`, initial commit, GitHub repo

**Done when:** `npm run dev` serves a blank styled page and all three check
commands pass on a clean clone.

## M1 — Content pipeline

- [x] Zod schemas for Lexeme, Sentence, GrammarTable (`src/content/schemas.ts`)
- [x] `npm run content:check` validates every file in `content/` and fails loudly with the offending path
- [x] Loader that builds an in-memory index: lexeme by id, sentences by level, sentences by feature
- [x] `content/_needed.json` convention for missing content
- [ ] 20 hand-authored A1 sentences as the seed set (I write these, not you) —
      **still open**, blocks nothing Claude needs to do next

**Done when:** `content:check` catches a deliberately broken fixture, and the
loader has tests covering a missing lexeme reference and a token with no features.

## M2 — Inflection engine

- [x] `inflect(lexeme, features)` for nouns, declensions 1–6, sg + pl, all 7 cases
      — voc.sg is a reported gap in every table, by design (see `_needed.json`)
- [x] `irregular` overrides take precedence
- [x] Consonant alternation rules from `content/grammar/alternations.json`
- [x] Table-driven tests: at least 5 nouns per declension class, full paradigm
- [x] `checkAnswer` with the correct / nearMiss / wrong contract from SPEC.md
- [x] Round-trip annotation check in `content:check` (CLAUDE.md rule 6)
- [ ] Human review + `content:approve` of the seven draft grammar files (ADR-008) —
      **yours, not Claude's**; until then every generated form is `unverified`

**Done when:** the full paradigm tests pass and `checkAnswer("Rīgā", "Riga")`
returns `nearMiss` while `checkAnswer("Rīgā", "Rīgu")` returns `wrong`.

## M3 — Review loop

- [x] Dexie schema for cards + review log; deterministic card generation from content
      (expected answers must never be `unverified` `inflect()` output — ADR-008;
      cloze answers are the sentence's own surface form, so this holds)
- [x] `ts-fsrs` integration in `src/engine/schedule.ts`, injectable clock
- [x] Cloze review screen: keyboard-first, Enter to submit, Enter again to advance
- [x] Latvian diacritic input helper (clickable `ā ē ī ū ķ ģ ļ ņ š ž č` row + a dead-key hint)
- [x] Session summary screen
- [x] Daily new/review caps, configurable (Settings tab, stored in IndexedDB)

**Done when:** I can do a full 20-card session, close the tab, reopen it, and the
scheduling state has survived.

## M4 — More exercise types + progress

- [x] `inflect`, `produce`, `recognize` exercise kinds (`inflect` answers are
      vouched for by an approved sentence — ADR-012 narrows ADR-008 here)
- [x] Per-feature retention tracking over trailing 30 reviews
- [x] Dashboard: weak features surfaced, sorted worst-first
- [x] JSON export/import of progress (+ weekly backup reminder)

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
2026-09-25 — M4 (Session 5): `featureRetention` (pure; the "ten failures in a
row" case is a test), recognize / produce / inflect cards and screens,
sibling burying (one new card per sentence per day — found by driving the
app: the inflect card was giving away the cloze answer minutes later),
Progress tab (stat tiles + worst-first retention tables, single validated
hue, tables double as the accessible view), Settings → Backup export/import
with a reminder after 7 days. ADR-012. Next: M5.
2026-09-25 — M3 UI (Session 4): `src/ui/` app shell (Review / Settings tabs),
cloze review screen driven by the pure `reviewReducer` (wrong answers
re-queued at the end, repeats graded but not counted in the summary), inline
answer input with the lemma in brackets, correct / near-miss diff / wrong
feedback, diacritic row that keeps focus, session summary with weakest
features, daily-limit settings (db schema v2 `settings` table). Content
material for review: 81 draft lexemes + 40-sentence `batch_002`
(ADR-010 lexeme gate, ADR-011 `npm run dev:drafts` preview). Checked in
Chromium via `dev:drafts`. M3's done-when (20-card session, close, reopen)
is covered by a close/reopen test at the data level; the real-browser check
is yours once content is approved. Next: Session 5 (M4).
2026-09-25 — M3 data layer: `src/engine/cards.ts` (one cloze card per
drillable token, stable ids, content order), `src/engine/schedule.ts`
(ts-fsrs behind our own Grade/SchedulingState types, injected clock, fuzz
off, `gradeFor` mapping), `src/engine/session.ts` (daily caps, due-first
selection), `src/db/db.ts` + `src/db/cards.ts` (Dexie: cards + append-only
review log indexed by feature; `syncCards` adds/retires/revives without
touching state; `recordReview` in one transaction). ADR-009 records the card
identity + grading decisions. Explicit test: sync, review, add a sentence,
regenerate, re-sync → old cards and log unchanged (mutation-checked). Also a
close/reopen persistence test. Deps: dexie, ts-fsrs, fake-indexeddb (dev).
600 tests passing. Next: Session 4, the cloze review screen — call
`syncCards` on startup, `loadSession` for the queue, `recordReview` per
answer, `systemClock` as the clock; add the caps setting there.
2026-09-25 — M2 done (engine side): `src/engine/inflect.ts` (nouns, decl 1–6,
sg+pl, irregular overrides, longest-match consonant alternation, gaps reported
not guessed, `confidence` verified/unverified), `src/engine/checkAnswer.ts`
(+ `diacriticDiff` for the review screen), round-trip check wired into
`content:check` (mismatch = error, gap = warning) and `content:approve` extended
to approve grammar files in place. Real grammar-table format replaces the
provisional M1 shape. Drafted all six noun tables + `alternations.json` as
`review: "draft"` under new ADR-008; 34 fixture nouns in
`src/engine/__fixtures__/nouns.ts` for review. No gold set in
`content/sentences/` yet, so the round-trip had nothing to run on; a throwaway
dry run over `batch_001`'s 11 noun tokens, using scratch lexemes (not
committed), passed with no mismatches. 567 tests passing. Open for you: review
and approve the grammar files, the new `_needed.json` entries (voc.sg,
masculine decl 4/5, a few alternation rules), and the new DECISIONS open
question about `galda`/`galdā`-type near misses. Next: Session 3, M3 data layer.
2026-09-18 — M1 mostly done: added ADR-006 (draft/approved split for sentences,
since the Session 1 prompt referenced it but it didn't exist yet) and the
matching SPEC.md fields; `src/content/schemas.ts` (Zod, incl. NFC checks),
`src/content/validate.ts` (`checkContent` + `buildApprovedSentence`, shared by
both CLI scripts), `src/content/loader.ts` + `src/content/index.ts` (three
indexes, drafts excluded from the glob), real `content:check` and new
`content:approve` scripts under `scripts/`. 22 tests added, all passing;
manually verified `content:check` against a broken fixture and
`content:approve` end-to-end, then removed the scratch files. Left open: the
20 hand-authored A1 seed sentences (explicitly the user's task) and the exact
GrammarTable shape (deliberately provisional — real ending-table format is
Session 2's job). Next: Session 2, M2 inflection engine.
2026-09-18 — M0 done: Vite+React+TS(strict)+Tailwind v4 scaffold, Vitest+Testing Library smoke test, ESLint+Prettier, `src/{engine,content,ui,db}` + `content/` layout with READMEs, `content:check` stub. All three check commands pass on a clean `npm ci`. Next: M1 content pipeline (Zod schemas, real `content:check`, loader).
