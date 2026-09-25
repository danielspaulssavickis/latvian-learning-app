# latvian-learning-app

A small web app for learning Latvian built around **inflectional morphology**:
the core exercise is producing the right *form* of a word in context, scheduled
by spaced repetition (FSRS), with progress tracked per case, number and
declension. Local-first — progress stays in your browser, with JSON
export/import as the backup — and installable to a phone's home screen.

Built with help from AI tools. Docs: [`docs/SPEC.md`](docs/SPEC.md) (what it
does), [`docs/ROADMAP.md`](docs/ROADMAP.md) (what's done),
[`docs/DECISIONS.md`](docs/DECISIONS.md) (why), [`docs/CLAUDE.md`](docs/CLAUDE.md)
(rules for AI sessions).

## Run it

```bash
npm ci
npm run dev          # the app, with approved content only
npm run dev:drafts   # the app with unreviewed drafts too (banner, separate progress)
npm run build        # production build in dist/ (incl. service worker)
```

Checks: `npm run typecheck && npm run lint && npm test && npm run content:check`.

## Content review workflow

Nothing reaches a learner without a human approving it. Drafts written by
Claude (or anyone) sit in `content/drafts/`, `content/lexemes/` and
`content/grammar/` with `review: "draft"`; open items are listed in
[`content/_needed.json`](content/_needed.json).

1. `npm run dev:drafts` — try the drafts in the real exercises.
2. Fix anything wrong directly in the JSON; `npm run content:check:drafts`
   validates it and runs the round-trip check (every tagged noun and pronoun
   must be reproducible by the inflection engine).
3. Approve — lexemes and grammar first, then sentences (one command does it
   in that order):

   ```bash
   npm run content:approve -- content/lexemes/*.json content/grammar/*.json content/drafts/batch_001.json
   ```

## Deploy

`.github/workflows/deploy.yml` publishes to GitHub Pages, manual trigger
only: enable Pages (Settings → Pages → Source: GitHub Actions), then run
"Deploy to GitHub Pages" from the Actions tab.
