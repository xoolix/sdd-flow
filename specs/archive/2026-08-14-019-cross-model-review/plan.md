# Technical Plan — 019-cross-model-review

## Inputs
- Spec: `specs/019-cross-model-review/spec.md`
- Clarifications: `discovery.md` (DISCOVERY-ACCEPTED: `--json`), `decisions.md` (D-001, D-002, PROTOTYPE-RESULT)
- Research: mini-run, companion v1.0.6 / codex-cli 0.147.0

## Domain analysis

| Domain | Complexity |
|---|---|
| `review-feature/SKILL.md` (detection, 3rd agent, annex, envelope) | MEDIUM |
| New `sdd-cross-reviewer.md` | MEDIUM |
| `sdd-implement-task.md` (`implemented-by` marker) | SMALL |
| Tests + docs | SMALL |

Overall MEDIUM: sequential slices.

## Current state
`review-feature/SKILL.md` runs inline: 1.5 reads state files, 2 resolves the mode, 3 fans out `sdd-reviewer` + `sdd-judge`, 4 consolidates verdicts, 6.5 appends `## JUDGMENT-DAY`. Nothing records the implementing model. 10 native agents; `tests/sdd.test.js:143` asserts `toHaveLength(10)`.

## Proposed design
A third, strictly **advisory** reviewer that never enters Step 4's table — the fix loops in `sdd-next`/`sdd-auto` branch only on `Verdict`, so cross-review output cannot reach them by construction. Every non-run is **audited** in `decisions.md`, never silent.

| Change | Where | Detail |
|---|---|---|
| Marker write | `sdd-implement-task.md` new 6b (after 6, before 7) | append `[<ISO-8601 UTC>] implemented-by: claude`; skip only if the **last** such line already says `claude` |
| Marker read | SKILL 1.5 | last `implemented-by:` → opposite runtime; absent → assume `claude` and note it |
| Detection | SKILL new 2.5 | glob `~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs` (highest version) + `command -v codex` → `CROSS_REVIEW_AVAILABLE` |
| Fan-out | SKILL 3 | launch `sdd-cross-reviewer` in the same parallel batch, gated on `judgment-day` AND `CROSS_REVIEW_AVAILABLE` |
| Consolidation | SKILL 4 | **UNTOUCHED**. Cross `FAIL` → warning `cross-review reported FAIL (advisory)` |
| Annex | SKILL new 6.6 | mirrors 6.5: `## CROSS-REVIEW — <feature-id>`, findings table, `Source: sdd-cross-reviewer (codex), review-feature phase`, `Date:` |
| Envelope | SKILL envelope | optional `**Cross-Review**: <verdict> (advisory, model: codex)` \| `skipped — <razón>`; extra fields are inert for orchestrator validation |
| Docs | `agent-frontmatter.md`, `CLAUDE.md` | counts 10→11 / 6→7; new Model Routing row |

**Agent** — frontmatter mirrors `sdd-reviewer`/`sdd-judge` (`model: sonnet`, `disallowedTools: [Agent, EnterPlanMode, ExitPlanMode]`). Body: resolve companion by glob → pick scope (`git status --porcelain` non-empty → `--scope working-tree`; clean → `--base $(sdd base-branch <feature-id>)`) → build focus text (ACs + touched files) → `node <companion> adversarial-review --wait --json <scope> "<focus>"` (**`--json` mandatory**; `--wait` is a documented no-op) → validate against `review-output.schema.json` → map to the judge's table: `Category` fixed as `cross-model`, `Evidence` ← `file:line_start-line_end`, `Description` ← `title`+`body`, `Suggested Action` ← `recommendation`, `Severity` passthrough. Verdict: `approve → PASS`; `needs-attention` → `FAIL` if any critical/high, else `PASS WITH WARNINGS`.

**Failure classification** — companion exit codes collapse to 1, so match stdout+stderr text, never the code:

| Pattern | Action |
|---|---|
| `Codex CLI is not installed` | skip, no retry |
| `codex login` / not-logged-in / auth-required | skip, no retry (human action) |
| `is still running`, `Unknown subcommand`, `not supported` | skip, no retry |
| anything else (network, turn failure, empty output) | **1 retry**, then `skipped — runtime error: <first stderr line, ≤200 chars>` |
| exit 0, JSON fails schema | `completed (unparseable, advisory)` + raw output truncated ~100 lines |

## Decisions settled here
- **Model `sonnet`** — focus distillation and stderr classification are judgment work, and sonnet is the routing convention for review internal workers; its cost is negligible against the ~2 min codex turn. Override to `haiku` via `.claude/rules/model-overrides.md`.
- **Timestamp ISO-8601 UTC** (`date -u +%Y-%m-%dT%H:%M:%SZ`), matching existing entries.

## Touched areas
- Files: `.claude/agents/sdd-cross-reviewer.md` (new), `review-feature/SKILL.md`, `sdd-implement-task.md`, `_shared/agent-frontmatter.md`, `.claude/CLAUDE.md`, `tests/sdd.test.js`
- Contracts: `decisions.md` gains `implemented-by:` + `## CROSS-REVIEW`; envelope gains `Cross-Review`. All additive.
- DB/schema, jobs, UI: none. `bin/sdd` unchanged (glob sync; prune never touches upstream agents).

## Data flow
`implement-task` writes the marker; SKILL 1.5 reads it, 2.5 detects the plugin, 3 fans out, the agent runs the companion and maps its JSON, 6.6 appends the annex and envelope line. The only writes are `decisions.md` appends.

## Migration / rollout
- Backfill: none — pre-019 features assume `claude` and annotate.
- Compatibility: additive; without the plugin, verdicts match today's.
- Flags: plugin presence *is* the flag; `--minimal` excludes cross-review.
- Rollback: `/plugin uninstall codex@openai-codex`, or revert the files.

## Observability
- Logs: `Cross-Review:` envelope line on every judgment-day run (verdict or skip reason), mirrored in `decisions.md`.
- Metrics: dogfood next 3 features — 0 blocked pipelines, 0 altered verdicts; audited skips OK.
- Alerts: none; skip streaks show in `decisions.md`.

## Test strategy
- Unit (`tests/sdd.test.js`): count 10→11; `existsSync` for the new agent; rename the topology test; assert `sdd-implement-task.md` contains `implemented-by:` and the SKILL contains `--json` and `CROSS-REVIEW`.
- Integration: none automated (process + network boundary).
- E2E/manual: one judgment-day run with the plugin installed (envelope + annex present), one with `codex` off `PATH` (`skipped —`, verdict unchanged).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Cross verdict leaks into the fix loop | Step 4 untouched; cross never sets `Verdict` — enforced by SKILL rule + test |
| Companion output drifts (v1.0.7+) | Schema-validate; degrade to `unparseable, advisory`, never to a block |
| ~2 min added latency | Parallel with reviewer + judge; wall clock ≈ unchanged |
| Silent skips hide a dead integration | Every skip audited with a reason string |
| Wrong scope on a clean tree | Scope from `git status --porcelain`, per PROTOTYPE-RESULT |

## Open questions
None.
