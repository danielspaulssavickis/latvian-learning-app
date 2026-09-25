# content

Authored data — lexemes, sentences, and grammar tables — stored as JSON and validated
against the Zod schemas in `src/content/schemas.ts`. Nothing here reaches a learner
without human review (see `docs/DECISIONS.md`): lexemes may be drafted with
`review: "draft"` and are approved in place (ADR-010);
sentences may be drafted into `drafts/` and move to `sentences/` only via
`npm run content:approve` (ADR-006, ADR-007); grammar files in `grammar/` may be drafted
with `review: "draft"` and are approved in place by the same command (ADR-008). Missing
content is tracked as an entry in `content/_needed.json` instead of being invented.

Review workflow: `npm run dev:drafts` to try drafts in the app, `npm run content:check:drafts`
to validate them, then `npm run content:approve -- content/lexemes/*.json content/grammar/*.json
content/drafts/batch_001.json` (lexemes and grammar are approved first, then sentences).
