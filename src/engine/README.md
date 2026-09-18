# engine

Pure TypeScript logic for scheduling, answer checking, and exercise generation — no
React imports, no DOM access, no `Date.now()` calls inside scheduling code. Everything
here is unit-testable in isolation with Vitest; if a piece of logic needs a component
or the browser to test, it belongs in `src/ui/` instead.
