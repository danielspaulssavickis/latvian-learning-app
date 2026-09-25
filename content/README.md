# content

Authored data — lexemes, sentences, and grammar tables — stored as JSON and validated
against the Zod schemas in `src/content/schemas.ts`. Nothing here reaches a learner
without human review (see `docs/DECISIONS.md`): lexemes are human-authored (ADR-004);
sentences may be drafted into `drafts/` and move to `sentences/` only via
`npm run content:approve` (ADR-006, ADR-007); grammar files in `grammar/` may be drafted
with `review: "draft"` and are approved in place by the same command (ADR-008). Missing
content is tracked as an entry in `content/_needed.json` instead of being invented.
