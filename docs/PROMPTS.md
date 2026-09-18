# Claude Code prompts

One milestone per session. Start each session with `/clear` (or a fresh terminal),
paste the prompt, and let it read the docs itself — that is cheaper than
re-explaining the project.

Between prompts: review the diff, commit, and make sure `docs/ROADMAP.md` got
updated. If it didn't, say "update the roadmap and session log before we stop."

---

## Session 0 — bootstrap

```
Read CLAUDE.md, docs/SPEC.md, docs/ROADMAP.md and docs/DECISIONS.md.

Then set up M0 only. Vite + React + TypeScript in strict mode, Tailwind,
Vitest with Testing Library, ESLint and Prettier. Create the directory layout
described in CLAUDE.md with a one-paragraph README in src/engine/ and content/.
Add the npm scripts listed in CLAUDE.md — content:check can be a stub that
exits 0 for now.

Do not build any app features. When the three check commands pass on a clean
install, tick the M0 boxes in docs/ROADMAP.md, add a session log line, and
make the initial commit.
```

## Session 1 — content pipeline

```
Read CLAUDE.md and docs/SPEC.md. We're doing M1.

Plan first, then implement: Zod schemas for Lexeme, Sentence and GrammarTable
exactly as specified in SPEC.md; a real content:check script that validates every
file under content/ and reports the failing file path and field; and a loader
that builds the three indexes SPEC.md describes.

Write tests for: a sentence referencing a lexeme id that doesn't exist, a token
with no features, and a sentence with no drillable token — all three must fail
validation with a useful message.

Also build the draft/approved split from ADR-006: content/drafts/ ignored by the
loader, and a content:approve script that moves a draft into content/sentences/,
sets review and reviewedAt, and refuses if that sentence fails validation.
Test that a draft sentence produces no cards.

Create content/_needed.json with a couple of example TODO entries so I can see
the format. Do not author Latvian sentences this session — I'm writing the
30-sentence gold set myself. Update the roadmap when done.
```

## Session 2 — inflection engine

```
Read CLAUDE.md, docs/SPEC.md and src/content/schemas.ts. We're doing M2.

Build src/engine/inflect.ts: given a lexeme and a feature set, return the
inflected form. Nouns only for now, declensions 1-6, singular and plural, all
seven cases. Irregular overrides on the lexeme win over the table. Consonant
alternation comes from content/grammar/alternations.json.

Important: the ending tables and alternation rules are linguistic data I need to
supply or verify. Build the engine and the table format, populate what you are
confident about, and list in content/_needed.json every cell you are unsure of
rather than guessing. I would rather have gaps than wrong endings.

Once inflect() works, extend content:check with the round-trip annotation check
from CLAUDE.md rule 6: every annotated token must be reproducible from its lexeme
and features, failing with sentence id, token index, expected and actual. Run it
against my gold set and show me every mismatch — some will be my tagging errors
and some will be gaps in your ending tables, and I need to see which is which.

Then build src/engine/checkAnswer.ts to the correct/nearMiss/wrong contract in
SPEC.md, with tests including the Rīgā/Riga/Rīgu cases.

Use plan mode. Tests before implementation for both modules.
```

## Session 3 — review loop, part 1 (data)

```
Read CLAUDE.md and docs/SPEC.md. M3, data layer only — no UI this session.

Dexie schema for cards and the review log. Deterministic card generation from
loaded content: one card per drillable feature instance, stable ids so that
adding new content never orphans existing review history — test that explicitly
by generating cards, adding a sentence, regenerating, and asserting the old
cards keep their state.

Integrate ts-fsrs in src/engine/schedule.ts with an injected clock. No Date.now()
inside the engine. Map correct/nearMiss/wrong plus response time to the four FSRS
grades and document the mapping in a comment.
```

## Session 4 — review loop, part 2 (UI)

```
Read CLAUDE.md and docs/SPEC.md. M3, UI.

Cloze review screen. Keyboard-first: type the answer, Enter submits, Enter again
advances. Show the sentence with the target token blanked and the lemma in
brackets. After submitting, show correct / near miss with the diacritic diff /
wrong with the correct form.

Include the diacritic input row (ā ē ī ū ķ ģ ļ ņ š ž č) — clicking inserts at the
cursor without losing focus. Session summary at the end: count, accuracy, and
which features were weakest.

Keep all logic in src/engine/ and src/db/; components read and dispatch only.
```

## Session 5 — progress dashboard

```
Read CLAUDE.md, docs/SPEC.md, docs/ROADMAP.md. M4.

Per-feature retention over the trailing 30 reviews, the remaining exercise kinds
(inflect, produce, recognize), and the dashboard that surfaces weak features
worst-first. Add JSON export/import of progress.

Before you build the dashboard, write the retention calculation as a pure
function in src/engine/ with tests, including the "ten failures in a row" case
from the roadmap's definition of done.
```

## Doc sync — use this instead of re-pasting files

When the plan changes in conversation (with me or with Claude in claude.ai) and
you don't want to regenerate and re-upload CLAUDE.md/SPEC.md/ROADMAP.md/DECISIONS.md
by hand, paste the change as a prompt in this shape. Claude Code already has the
current files on disk — it edits them in place instead of you reconstructing them.

```
The plan has changed: <describe the change in plain language, or paste the
relevant part of the conversation where it was decided>.

Before editing anything: read CLAUDE.md, docs/SPEC.md, docs/ROADMAP.md and
docs/DECISIONS.md in full, and tell me every place this change touches —
including places I haven't mentioned, like roadmap milestones that assumed
the old behavior, or an ADR that's now contradicted. Wait for me to confirm
before editing.

Once I confirm: edit the docs directly.
- CLAUDE.md: update the specific rule(s) affected. Don't rewrite unrelated
  sections. Keep it under 200 lines.
- docs/SPEC.md: update the data model or exercise spec if the change touches
  what content looks like or what the app does.
- docs/DECISIONS.md: append a new ADR. If it reverses an earlier ADR, mark
  that old entry "superseded by ADR-00X" — don't delete it.
- docs/ROADMAP.md: update any unchecked milestone item this affects. If work
  already marked done is now wrong, don't uncheck it silently — add a note.

Show me a summary of what changed in which file before you consider this done.
```

This works for a small wording tweak or a real architectural reversal — for a
small one, skip the "wait for confirm" step and just say so.

### Ready to paste: PWA target + iOS storage risk

This fills in the template above for the decision from our last conversation —
the app stays a website, targets installable PWA so it works on iPhone, and
IndexedDB persistence on iOS Safari is a known risk to design around rather
than ignore.

```
The plan has changed: this stays a web app, no native iOS app. But it needs to
work well on an iPhone, specifically as an installable PWA — add to home
screen, fullscreen, works offline for a session.

This also surfaces a risk I want documented, not solved yet: iOS Safari can
evict IndexedDB data after a period of inactivity for a home-screen PWA, and
has had version-specific IndexedDB bugs. For a spaced-repetition app that's a
real risk to review history, so it needs a mitigation path even if we don't
build it now.

Before editing anything: read CLAUDE.md, docs/SPEC.md, docs/ROADMAP.md and
docs/DECISIONS.md in full, and tell me every place this touches. Wait for me
to confirm before editing.

Once I confirm:
- docs/DECISIONS.md: append a new ADR for "installable PWA, web-only, no
  native app" — reference ADR-002 (local-first, no backend) since the storage
  risk is a direct consequence of that decision, not a new one. Record the
  mitigation path (JSON export/import nudge, defined in M4, surfaced as a
  periodic reminder; a minimal single-blob sync backend as the fallback if
  eviction turns out to bite in practice) as the plan, without building it.
- docs/ROADMAP.md: M5 already has "responsive layout, works on a phone" —
  expand it into explicit PWA line items (manifest, service worker, install
  test on an actual iPhone) and add a line noting the IndexedDB eviction risk
  with a pointer to the new ADR. Don't invent a new milestone for this.
- CLAUDE.md: only touch it if there's a standing rule this changes, e.g. if
  you think a "no native mobile app" line belongs in Out of scope.

Show me a summary of what changed in which file before you consider this done.
```

### Other reusable prompts

- `Show me the plan before you write anything.` — for any multi-file change
- `/context` — check what actually loaded; useful when CLAUDE.md seems ignored
- `Append what you just decided to docs/DECISIONS.md as a new ADR.`
- `Update docs/ROADMAP.md and add a session log line, then stop.` — end every session with this
- `That's out of scope for this milestone. Note it in the roadmap under a Backlog heading and move on.`
- `Before adding that dependency: what does it replace, and what breaks if we don't?`
