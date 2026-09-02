# Technical Plan — 026-gentle-ai-skills-tdd-archive-verify

## Domain analysis summary
MEDIUM overall → sequential slices with checkpoints (CLI surface, Phase agents, Orchestration skills, Test suite MEDIUM; docs/skills SMALL).

## Current state
| Fact | Evidence |
|---|---|
| Nothing reads the archive commit after it lands | `bin/sdd:1186-1188` commits, prints SHA, stops |
| `status` blind to duplicates; `blockers` dead | `bin/sdd:879` resolves `specs/<id>/` first; `:1586` hardcodes `[]`; list mode `:1517-1552` narrower |
| Cycle is 3 steps, evidence dispersible | `sdd-implement-task.md:66-71`, L79 "or the task notes" |
| Step 3.5 pinned hard | `sdd.test.js:474-537`: 2 fence delimiters, no `if [`/`case`/`elif` |

## Proposed design
**`sdd verify-archive <feature-id>`** — `cmd_verify_archive` beside `cmd_state_write`, a pure-shell port of `sdd.test.js:2588-2660`; dispatch `bin/sdd:1667-1684`; usage follows `state-write`'s shape. HEAD only, no `--commit` flag (the gate runs post-phase, `status` covers later).

| Exit | Meaning |
|---|---|
| 2 | usage |
| 3 | unresolvable: no archive dir, or HEAD adds nothing under it (never 1/2 — keeps `documented-cli-usage`'s fixture green) |
| 1 | failed, naming the missing half |
| 0 | ≥1 `D` under `specs/<id>/`, ≥1 `A` under the archive dir, `specs/<id>/` gone from `git ls-tree -r HEAD` |

**Ambiguity (resolved)**: local sorted glob, guard-before-expand; >1 match → lexicographic max (latest date) + stderr note; 0 → exit 3. `resolve_feature_dir` untouched.

**`sdd status` pre-check** — before `detect_feature_phase`, independent of `resolve_feature_dir`. Both paths present → `"phase": "archive-integrity-broken"` (9th literal, additive) + a `blockers` entry naming both; exit stays 0 (status reports, gates decide). List mode: same literal, same JSON shape.

**TDD contract** — TRIANGULATE becomes step 3 of 4 (`sdd-implement-task.md:66-71`), default-mandatory, annotated structural skip; L79's dispersal tightens to a mandatory `TDD-Evidence` envelope field (RED / GREEN output, N cases or skip), declared in `sdd-phase-common.md` §D like `Commit`, its validation clause verbatim in §F, `sdd-next` Step 4 and `sdd-auto` Step 2 (consistency-pinned). `sdd-reviewer.md` gains a step 2.5 (file exists, passes, N cases; fabricated ⇒ CRITICAL) — mechanical, it runs on haiku.

**Archive self-check** — on Step 3.5's "On success" bullet: run `` `sdd verify-archive $ARGUMENTS` `` **before** deleting `.sdd-state`, blocked on nonzero. Inline code, never a fence (a second breaks the 2-fence pin) — no test edit. Step 3.6 gains a `branch-pr`/`chained-pr` pointer, Step 7.5 a `work-unit-commits` one.

**ADR 0005** — `docs/adr/0005-phase-handoffs-verified-by-cli.md`, "Phase handoffs are verified by deterministic CLI checks, not agent prose". Spanish, 0004's register: Contexto (025's gate) · Qué pasó (021, 294ccfc) · Decisión (ceremony is CLI code; orchestrators trust exit codes) · Consecuencias · Alternativas.

## Touched areas
| Module / path | Change |
|---|---|
| `bin/sdd` `:11`, `:77-125`, `:1667-1684` | `CORE_SKILLS` +4 (one line), usage block, dispatch |
| `bin/sdd` near `cmd_state_write`; `:1517-1552`, `:1574-1596` | new `cmd_verify_archive`; integrity pre-check both modes + `blockers` |
| `.claude/skills/{work-unit-commits,comment-writer,branch-pr,chained-pr}/SKILL.md` | verbatim draft copies |
| `.claude/skills/build-registry/SKILL.md:18` | +4 backticked names |
| `.claude/agents/sdd-implement-task.md` | L66-71, L73-83, L127-134, envelope L187-204, Step 7.5 |
| `.claude/agents/sdd-archive-feature.md`, `sdd-reviewer.md` | L58 self-check + L63-72 PR pointer; new step 2.5 |
| `_shared/sdd-phase-common.md`, `sdd-next/SKILL.md`, `sdd-auto/SKILL.md` | §D field + the same §F clause verbatim |
| `.claude/rules/testing.md` + `.specify/templates/rules/testing.md` + `.claude/skills/tdd/SKILL.md` | one-line cycle sync |
| `tests/sdd.test.js`, `tests/sweep-retired-symbols.test.js` | new describes + literal sweep |
| `docs/adr/0005-phase-handoffs-verified-by-cli.md` | new |

## Data flow
Agent `mv`s → `commit-slice --moved-from` stages both halves → agent self-check → orchestrator re-runs `verify-archive`; nonzero blocks `.sdd-state` deletion and fails the phase (non-retryable, no new semantics). `status` globs both locations. TDD evidence: envelope → orchestrator structural check → reviewer reality check.

## Migration / rollout
N/A — no schema or persisted state; all additive; skills install on next `init`/`update`. Rollback = revert the slice range.

## Observability
N/A — no runtime service; exit codes, stderr and `status` JSON are the whole surface.

## Test strategy
- **Unit** (temp repos, `sdd.test.js`): bypass commit (altas only) ⇒ exit 1 naming missing deletions; legit `--moved-from` ⇒ exit 0; two archive dirs ⇒ latest + note; no archive ⇒ exit 3; `status` break in single **and** list mode.
- **Integration**: `documented-cli-usage` auto-runs the self-check line; cross-file pin for `TDD-Evidence` in the 3 orchestrator files; prose pins for TRIANGULATE, step 2.5, the 4 names.
- **Invariants + E2E**: sweep for the retired commit-knob literal (needle concatenated); purity grep 0; 026 archives itself through the gate.

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| Purity greps regress | Pure shell (`awk -F'\t'`), bash 3.2-safe; literal never typed; `CORE_SKILLS` one line (`sdd.test.js:3023`) |
| haiku agent skips its self-check | The orchestrator gate (AC6) is the guarantee, `status` the backstop — ADR 0005's point |
| Rename detection hides deletions | `--no-renames` everywhere |
| Stale 2-step prose contradicts the contract | One-line sync of `rules/testing.md` + mirror + a `/tdd` pointer; no doctrine rewrite |

## Open questions
None; the multi-date ambiguity is resolved above.
