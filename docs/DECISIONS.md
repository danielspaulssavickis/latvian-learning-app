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
**Superseded by ADR-007 for sentence content — see below.**

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
- **Seed corpus size.** How many sentences before the app is worth using daily?
  Guess: ~150 covering A1. Measure after M3 rather than guessing further.
