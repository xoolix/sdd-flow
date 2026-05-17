# Technical Plan

## Inputs
- Spec: specs/003-plan-discovery-checkpoint/spec.md
- Clarifications: none
- Research inputs: Codebase exploration of `.claude/skills/plan-feature/SKILL.md`, `CLAUDE.md`, `sdd-phase-common.md`

## Current state

`/plan-feature` runs a linear pipeline:

| Step | Action |
|------|--------|
| 1 | Pre-flight + memory recovery |
| 2 | Read spec |
| 3 | Domain analysis (inline) |
| 4 | Explore agents (parallel, per domain) |
| 5 | Design agent + Task planner agent (parallel) |
| 6 | Review and present plan.md + tasks.md |
| 7 | Engram save |

No pause point exists between exploration and design. Exploration findings flow directly into design without product-level evaluation.

## Proposed design

Insert a **Discovery Evaluator sub-agent** between Step 4 and Step 5:

| Step | Action |
|------|--------|
| 4 | Explore agents (parallel) → raw findings |
| 4.5 | **Discovery Evaluator sub-agent** → `discovery.md` |
| 4.6 | **If high-impact findings** → return `Status: blocked` with structured findings |
| 4.7 | **(Resume path)** User responds → `sdd-continue` re-invokes `/plan-feature` |
| 5 | Design + Task agents (if no pause, or on resume) |

**Fast path (no high-impact findings):** Evaluator writes `discovery.md`, pipeline continues to Step 5 automatically.

**Pause path (high-impact findings):** Evaluator writes `discovery.md` with findings, `/plan-feature` returns `Status: blocked`. Orchestrator surfaces findings to user.

**Resume path:** `sdd-continue` re-invokes `/plan-feature`. Plan-feature detects `discovery.md` exists → skips Explore + Evaluator → jumps straight to Step 5. User decisions are written to `decisions.md` as `DISCOVERY-ACCEPTED` / `DISCOVERY-DISCARDED` tags.

### Discovery Evaluator — significance criteria

| Category | High impact (pause) | Medium/Low (continue) |
|----------|--------------------|-----------------------|
| Reuse opportunities | Existing module covers >50% of spec | Minor shared utility |
| Simplifications | Removes a whole design layer | Small code savings |
| Edge cases | Uncovered case that changes data model | UX edge case only |
| Adjacent features | Conflict with in-progress feature | Overlap with archived feature |

Only **high-impact** findings trigger a pause. Medium/low are recorded in `discovery.md` for context.

### discovery.md schema

```
# Discovery Report
status: clear | findings-present
## High-impact findings
- [category] [description] [impact: high]
## Other findings
- [category] [description] [impact: medium|low]
## User decisions
- DISCOVERY-ACCEPTED: ...
- DISCOVERY-DISCARDED: ...
```

## Touched areas

| Area | Files |
|------|-------|
| Files modified | `.claude/skills/plan-feature/SKILL.md`, `.claude/CLAUDE.md` |
| Files created | `specs/<id>/discovery.md` (runtime artifact, not committed to skills) |
| APIs/contracts | Return envelope: `Status: blocked` with `discovery.md` path in Artifacts |
| DB/schema | n/a |
| Jobs/workers | n/a |
| UI surfaces | n/a |

## Data flow

**Normal (no pause):**
Explore agents → Evaluator sub-agent → `discovery.md` (status: clear) → Design + Task agents → `plan.md` + `tasks.md`

**Pause:**
Explore agents → Evaluator sub-agent → `discovery.md` (status: findings-present) → `plan-feature` returns `blocked` → orchestrator shows findings → user responds → `sdd-continue` re-invokes `plan-feature` → reads `discovery.md` → Design + Task agents → `plan.md` + `tasks.md`

## Migration / rollout

| Concern | Decision |
|---------|----------|
| Backfill | No existing `plan.md` artifacts are affected |
| Compatibility | `discovery.md` absence = legacy run; treat as fast path |
| Feature flags | None needed — guarded by file presence check |
| Rollback | Remove Step 4.5–4.7 from SKILL.md; pipeline returns to current behavior |

## Observability

| Signal | Detail |
|--------|--------|
| Logs | Evaluator sub-agent outputs finding list + classification to conversation |
| Metrics | n/a (no runtime instrumentation) |
| Alerts | n/a |

## Test strategy

| Layer | Approach |
|-------|----------|
| Unit | Review evaluator prompt: does it classify a seeded finding as high/medium/low correctly? |
| Integration | Run `/plan-feature` on a spec with a known reuse opportunity; verify `blocked` returned and `discovery.md` written |
| E2E/manual | Full `/sdd-ff` run on a greenfield spec; verify pipeline auto-advances when no high-impact findings |

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Evaluator over-triggers (too many pauses) | Strict high-impact criteria; medium/low never pause |
| Stale `discovery.md` on re-spec | Delete `discovery.md` when spec.md is regenerated (`/sdd-new` cleanup step) |
| Phase detection ambiguity (has spec, no plan, has discovery.md) | Document in CLAUDE.md: `discovery.md` present + no `plan.md` = resume path, run `/plan-feature` |
| Evaluator sub-agent cost | Single-pass, lightweight prompt; use `haiku` model |
