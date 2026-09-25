# DECISIONS

Append-only. One entry per decision that a future session would otherwise
re-litigate. Format: number, date, decision, why, what it rules out.

---

## ADR-001 — Morphology is the core, not vocabulary
**2026-09-18 · accepted**

The primary exercise produces an inflected form in context. Translation recall is
a secondary exercise type.

*Why:* Latvian is heavily inflected; isolated word-pair recall does not transfer
to production. This is the entire reason to build rather than use an existing app.

*Rules out:* a pure Anki clone; word-pair-only content; treating grammar as an
optional "lesson" section bolted onto flashcards.

## ADR-002 — Local-first, no backend
**2026-09-18 · accepted**

Progress lives in IndexedDB. Backup is JSON export/import.

*Why:* removes auth, hosting cost, GDPR surface, and most of the work. A single
user does not need sync.

*Rules out:* accounts, multi-device sync, leaderboards, server-side analytics.
*Revisit if:* I actually want this on two devices — then the cheapest path is a
single signed-URL blob store, not a full backend.

## ADR-003 — FSRS over SM-2
**2026-09-18 · accepted**

Scheduling uses `ts-fsrs`.

*Why:* better-calibrated intervals than SM-2, maintained library, four-grade
interface fits the correct/nearMiss/wrong check result cleanly.

*Rules out:* writing the scheduler by hand. If `ts-fsrs` becomes a problem,
replace the module, not the interface — `src/engine/schedule.ts` is the seam.

## ADR-004 — Content is authored, never generated
**2026-09-18 · accepted**
**Superseded by ADR-007 for sentence content and by ADR-010 for lexemes — see below.**

Every Latvian lexeme, gloss and irregular form in `content/` is written or
reviewed by a human before it ships — this still stands. Sentence drafting is
now governed by ADR-007 instead.

## ADR-006 — Draft/approved split for sentence content
**2026-09-18 · accepted**

New sentences start in `content/drafts/*.json`, validated against the same
schema as `content/sentences/`, but excluded from the app's content loader — a
draft can never generate a review card. `npm run content:approve <path>`
validates the draft and, if it passes, sets `review: "approved"` and
`reviewedAt: <ISO timestamp>`, writes the file into `content/sentences/`, and
deletes the draft. If validation fails, it refuses and reports the error; no
files move.

*Why:* ADR-004 requires a human review step before content ships. Keeping
drafts on disk (rather than in chat or a separate scratch file) lets
`content:check` validate them early, while the directory they live in — not
the `review` field — is the actual gate the loader honors. `review`/
`reviewedAt` are an audit trail set only by `content:approve`, never authored
by hand.

*Rules out:* sentences reaching `content/sentences/` without going through
`content:approve`; the loader ever reading `content/drafts/`.

## ADR-007 — Claude may draft sentences, pending human approval
**2026-09-19 · accepted**

Claude Code may write candidate sentences into `content/drafts/*.json`. A
draft only reaches `content/sentences/` — and only then can it generate a
review card — after the human runs `npm run content:approve` (ADR-006) and it
passes validation. This applies to *sentences only*; ADR-004 still fully
applies to lexemes, glosses, and irregular forms, since ADR-006's
draft/approve mechanism only exists for sentences.

*Why:* the draft/approved split (ADR-006) already puts a hard technical gate
between anything Claude writes and what the app actually uses — a draft
cannot generate a review card no matter who wrote it. That gate, not a
blanket authorship ban, is what protects the learner from wrong content.

*Rules out:* Claude committing a sentence directly to `content/sentences/`;
skipping `content:approve`; treating this as license to author lexemes or
grammar-table endings, which have no review gate yet.

*Amended by ADR-008:* grammar tables now have a review gate, so the
grammar-table part of this "rules out" no longer applies. Lexemes still do.

## ADR-008 — Grammar tables get a review gate; Claude may draft them
**2026-09-25 · accepted**

Files in `content/grammar/` (noun ending tables, `alternations.json`) carry the
same `review`/`reviewedAt`/`source` fields as sentences. Claude may write them
with `review: "draft"`. `npm run content:approve -- content/grammar/<file>.json`
validates the file and sets `review: "approved"` + `reviewedAt` **in place** —
grammar files don't move directories, because `inflect()` needs draft tables
to run at all (tests, the round-trip check). The gate is the field instead:
`inflect()` returns `confidence: "unverified"` for any form built from a table
or alternation rule file that isn't approved, and `"verified"` only when every
piece of data behind the form was human-reviewed (an `irregular` override, the
lemma itself, or approved grammar files).

*Why:* M2 needs ending tables to exist before the engine can be tested, and
the Session 2 prompt asked Claude to populate the cells it's confident about
and list the rest as gaps. Without a gate that contradicted ADR-007. A draft
cell can't reach a learner today — cloze answers are the approved sentence's
own surface form, not generated — and the `confidence` flag is the hook that
keeps it that way once generated forms are used.

*Rules out:* exercise generation (M3/M4 — the `inflect` exercise kind in
particular) showing an `unverified` form as an expected answer; hand-editing
`review` to `"approved"`; a missing cell being filled by a guess — a gap is
reported by `inflect()` as `reason: "gap"` and by `content:check` as a warning.
Lexemes remain human-only (ADR-004); this ADR does not cover them.

## ADR-009 — Card identity, sync, and grading
**2026-09-25 · accepted**

**One cloze card per drillable token**, id `cloze:<sentenceId>#<tokenIndex>`.
Not one card per (token, feature) pair: every feature of a token would
produce the same blanked sentence with the same answer, i.e. duplicate cards.
The card's `feature` is the token's most specific feature (mood > case >
tense > person > number > gender > definiteness), and `features` lists all of
them plus the lexeme's `declension:N` / `conjugation:N`, so M4's per-feature
retention can credit every feature an answer exercised. Each review log entry
copies `features` from the card, so history stays attributable even if the
content changes later.

**Sync, never regenerate state.** `generateCards` (pure, `src/engine/cards.ts`)
derives specs from content; `syncCards` (`src/db/cards.ts`) adds unseen cards
as new, refreshes content-derived fields on existing ones, and never touches
`fsrs` or the review log. A card whose content disappears is *retired*
(kept, not scheduled) and revived with its state if the content returns.

**Grading.** `gradeFor` in `src/engine/schedule.ts`: wrong → again, near miss
→ hard (any time), correct → easy under 5 s, hard over 20 s, good otherwise.
The thresholds are first guesses — tune them once there's a real review log.
FSRS fuzz is off, so scheduling is deterministic for a fixed clock.

*Why:* SPEC.md requires that adding content never orphans history, and that
scheduling be testable against fixed clock values.

*Rules out:* token-index-free card ids (e.g. hashing the surface) — a sentence
id plus token index is simple and stable as long as an approved sentence's
tokens aren't reordered. **Re-tokenizing an approved sentence moves its cards'
history to the wrong token or retires it**; add a new sentence id instead.
Also rules out deleting cards during sync, and calling `Date.now()` / `new
Date()` anywhere in `src/engine/` (the one real clock is `systemClock` in
`src/db/db.ts`).

*Dependencies added:* `dexie` and `ts-fsrs` (both already in CLAUDE.md's
stack), and dev-only `fake-indexeddb`, which replaces nothing: jsdom has no
IndexedDB, so without it `src/db/` can't be tested under Vitest.

## ADR-010 — Lexemes get a review gate; Claude may draft them
**2026-09-25 · accepted** · supersedes ADR-004 for lexemes

Lexeme files carry `review`/`reviewedAt`/`source` like grammar files, and
are approved in place with `npm run content:approve -- content/lexemes/<id>.json`
(any number of paths; shell globs work). Consequences:

- `inflect()` marks a form `verified` only if its **lexeme** is approved too —
  including `irregular` overrides and the lemma itself.
- A sentence can only be approved once **every lexeme it references is
  approved** and it **passes the round-trip check**. So an approved sentence
  never shows a learner an unreviewed lemma or gloss, and approval can never
  produce content that makes the app fail to load.
- Pronouns keep their whole paradigm in `irregular` (they're suppletive);
  `inflect()` never builds a pronoun form from an ending table.

*Why:* you asked Claude to produce the material the app needs and review
the language later. The chain lexeme → sentence approval keeps "nothing
unreviewed reaches a learner" true without blocking the drafting.

*Rules out:* approving a sentence ahead of its lexemes; hand-editing
`review`; a lexeme without `review: "approved"` counting as human-checked.

## ADR-011 — Dev-only draft preview
**2026-09-25 · accepted** · narrows ADR-006's "loader never reads drafts"

`npm run dev:drafts` (Vite mode `drafts`) runs the app on published content
**plus** `content/drafts/`, so drafts can be tried in context before
approval. `src/content/index.ts` still never globs drafts; the separate
`src/content/preview.ts` does, and `src/main.tsx` imports it only when
`import.meta.env.DEV && MODE === 'drafts'`. Preview progress goes to a
separate IndexedDB (`latvian-trainer-preview`), and the app shows a
persistent "unreviewed content" banner. `npm run build` ends with
`scripts/check-dist.ts`, which fails if any draft sentence text is in `dist/`.

*Why:* reviewing a sentence in the exercise it will actually appear in
catches problems a JSON diff doesn't (an odd blank, a confusing gloss).

*Rules out:* a production or deployed build that can show drafts; draft
cards entering the real review history.

## ADR-012 — Exercise kinds, card order, and sibling burying
**2026-09-25 · accepted** · extends ADR-009

`generateAllCards` makes, per sentence: one `recognize` card
(`recognize:<sentenceId>`), one `cloze` per drillable token, one `produce`
card (`produce:<sentenceId>`); and one `inflect` card per distinct
(lexeme, case.number) among drillable noun/pronoun tokens
(`inflect:<lexemeId>@<case>.<number>`). Within a sentence, new cards come
easiest first: recognize → cloze → inflect → produce.

**Sibling burying.** At most one new card per sentence per day, and none
from a sentence already studied today. So a sentence walks through its
kinds over several days instead of giving away its own answers minutes
apart (the cloze answer "Rīgā", then "Rīga → locative singular").

**Inflect answers.** An `inflect` card exists only where `inflect()`
reproduces an approved sentence's own surface form (case-folded), so its
answer is vouched for by that sentence even while the grammar tables are
drafts. This narrows ADR-008's rule, which is about forms *no* reviewed
sentence backs — those still never become answers.

**Checking.** `produce` compares the whole sentence with punctuation ignored
and word order as authored (see the open question below); `recognize` is
multiple choice among the sentence's gloss and three other glosses picked by
a stable hash of the card id, so the choices don't reshuffle between visits.

**Retention** (dashboard): per feature, share of the trailing 30 answers
that were correct or a near miss; ordered worst-first, ties broken by the
current run of wrong answers. Skills (`skill:recognize`, …) are listed
separately; `number:sg` is hidden as noise.

*Rules out:* the old "one card per sentence per kind per day" ordering where
all of a sentence's cards could land in one session; inflect cards for forms
no approved sentence contains.

---

## Open questions

- **ADR-005 — audio source.** Options: record it myself, use a Latvian TTS
  service, or ship without audio until M5. Needs investigation into what Latvian
  TTS is available and under what licence before committing. Do not pick a
  provider without checking terms for redistributing generated audio.
- ~~**Declension class coverage.**~~ *Resolved 2026-09-25:* M2 covers all six,
  as draft tables (ADR-008). Masculine nouns of declensions 4 and 5 (puika,
  bende) are not covered yet — see `content/_needed.json`.
- **Diacritic-only differences that are a different form.** SPEC.md makes any
  diacritic-only difference a near miss, but in Latvian some of those are a
  different case: `galda` (gen.sg) vs `galdā` (loc.sg), `māja` vs `mājā`.
  `checkAnswer` follows SPEC.md today (tested). Option for M3: when the given
  answer is itself another form of the same lexeme, call it `wrong`. Decide
  before the review screen goes live.
- **Definiteness.** Adjective definite/indefinite endings are a real A2 topic but
  add a dimension to every adjective card. Decide before building adjective
  support whether it is in scope for v1.
- **Word order in `produce`.** Latvian word order is flexible; `produce`
  only accepts the authored order ("Man šodien jāstrādā" vs "Šodien man
  jāstrādā"). Options: accept any permutation of the same words as correct,
  or as a near miss, or list accepted alternatives per sentence. Decide once
  there's review data showing how often this bites.
- **Seed corpus size.** How many sentences before the app is worth using daily?
  Guess: ~150 covering A1. Measure after M3 rather than guessing further.
