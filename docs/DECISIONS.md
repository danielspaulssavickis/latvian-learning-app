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

Every Latvian sentence, gloss and irregular form in `content/` is written or
reviewed by a human before it ships. Claude Code may build tooling, schemas and
generators, but may not author Latvian content.

*Why:* LLM-generated Latvian is fluent-sounding and subtly wrong about case
government and verb aspect, in exactly the places the app is meant to teach.
Wrong content is worse than no content — the learner drills the error.

*Rules out:* bulk-generating the seed corpus; "just fill in 200 example
sentences"; runtime AI generation of exercises.

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
