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

---

## Open questions

- **ADR-005 — audio source.** Options: record it myself, use a Latvian TTS
  service, or ship without audio until M5. Needs investigation into what Latvian
  TTS is available and under what licence before committing. Do not pick a
  provider without checking terms for redistributing generated audio.
- **Declension class coverage.** Classes 5 and 6 are lower frequency. Decide
  whether M2 must cover all six or can ship 1–4 and follow up.
- **Definiteness.** Adjective definite/indefinite endings are a real A2 topic but
  add a dimension to every adjective card. Decide before building adjective
  support whether it is in scope for v1.
- **Seed corpus size.** How many sentences before the app is worth using daily?
  Guess: ~150 covering A1. Measure after M3 rather than guessing further.
