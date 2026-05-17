# Decisions

## Delta: 2026-04-13 — Implementation

- **MODIFIED**: Plan's data flow stated "Normal (no pause): Evaluator writes `discovery.md` (status: clear)". Implementation does NOT write `discovery.md` on the fast path — file absence signals "no high-impact findings". This is simpler and avoids unnecessary file I/O. The `status: clear` value from the plan schema is unused.

## Open: Stale discovery.md cleanup
- `/sdd-new` should delete `discovery.md` when regenerating a spec. Deferred — will be addressed when `/sdd-new` skill is next updated.

## Open: Discovery Evaluator JSON error handling
- If the haiku model returns malformed JSON (prose outside code block), the orchestrator has no documented fallback. Deferred — low probability with structured prompt, will be addressed if observed in practice.
