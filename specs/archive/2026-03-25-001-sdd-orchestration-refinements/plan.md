# Technical Plan

## Inputs
- **Spec**: `specs/001-sdd-orchestration-refinements/spec.md`
- **Domain analysis**: SMALL-MEDIUM — 3 domains (skills, templates, rules), all markdown edits
- **Exploration findings**: Skills already have delegation language but lack hard-stops; GWT is encouraged but not enforced

## Current state

| File | Current behavior | Gap |
|------|-----------------|-----|
| `plan-feature/SKILL.md` | Says "delegate, don't execute" in rules but no tool-level hard-stop | Orchestrator can still call Read/Grep/Edit on source code |
| `plan-feature/SKILL.md` | Step 3 launches Explore agents per domain | Exploration is part of the flow but not an explicit mandatory first phase |
| `review-feature/SKILL.md` | Compliance matrix shows GWT examples | Does not enforce GWT format or require test-to-scenario mapping |
| `new-feature/SKILL.md` | Step 6 asks for GWT, says "help them rewrite" | Advisory — spec can be generated with non-GWT criteria |
| `spec-template.md` | Has GWT placeholders and a comment | No explicit warning that non-GWT will be rejected |
| `CLAUDE.md` | Agent usage section mentions Explore agents | No orchestration discipline rules about allowed tools |

## Proposed design

### Change 1: Orchestrator hard-stop (`plan-feature`, `review-feature`)

Add a `## Hard-stop: Orchestrator boundaries` section near the top of both SKILL.md files:

| Rule | Detail |
|------|--------|
| **NEVER use** | `Read`, `Edit`, `Write`, `Grep`, `Glob` on source/config files |
| **Allowed reads** | `spec.md`, `plan.md`, `tasks.md`, `decisions.md`, architecture-map output |
| **Delegation** | All source code analysis goes through Explore agents (`subagent_type: "Explore"`) |
| **Violation** | If you catch yourself about to read a `.ts`, `.py`, `.json`, etc. file — STOP and delegate |

In `plan-feature/SKILL.md`: Insert after the frontmatter bold line (line 13). Update existing Rules section to reference hard-stop.

In `review-feature/SKILL.md`: Insert after the frontmatter bold line (line 13). Update existing Rules section to reference hard-stop.

### Change 2: Integrated explore phase (`plan-feature`)

Restructure Steps to make exploration an explicit, mandatory **Step 1** before domain analysis:

| Current flow | New flow |
|-------------|----------|
| 1. Read spec | 1. Read spec (allowed — state file) |
| 2. Domain analysis | 2. **Mandatory explore**: Launch Explore agent(s) for codebase mapping. Cannot skip. |
| 3. Delegate exploration | 3. Domain analysis (informed by explore results) |
| 4. Delegate design + tasks | 4. Delegate design + tasks (receives spec + explore findings) |
| 5. Review and present | 5. Review and present |

The explore agent receives the spec summary and returns: relevant files, current patterns, dependencies, domain boundaries.

### Change 3: GWT enforcement (`new-feature`, `review-feature`)

**`new-feature/SKILL.md`** — Replace advisory language with hard-stop:
- Step 6: Change "help them rewrite" to "Do NOT proceed until all criteria are in Given/When/Then format. If the user provides free-form criteria, rewrite them into GWT and confirm before moving on."
- Quality gate: Add explicit check — "All acceptance criteria follow `Given [X], When [Y], Then [Z]` pattern"

**`review-feature/SKILL.md`** — Strengthen compliance matrix:
- Step 4: Add rule — "Each row MUST map to a specific GWT scenario from the spec. The `Acceptance Criterion` column must preserve the exact Given/When/Then wording."
- Add rule — "If a criterion is not in GWT format, flag as MALFORMED and mark NON-COMPLIANT"

### Change 4: CLAUDE.md orchestration discipline

Add a new `## Orchestration discipline` section after `## Agent usage`:

```
## Orchestration discipline
- `/plan-feature` and `/review-feature` are orchestrators — they NEVER use Read/Edit/Write/Grep/Glob on source code.
- Orchestrators may only read state files: spec.md, plan.md, tasks.md, decisions.md, architecture-map output.
- All source code analysis is delegated to Explore agents.
```

### Change 5: Spec template GWT guidance

In `spec-template.md`, strengthen the Acceptance Criteria comment:

```
<!-- REQUIRED: All criteria MUST use Given/When/Then format. Non-GWT criteria will be rejected. -->
```

## Touched areas

| File | Change type | Size |
|------|------------|------|
| `.claude/skills/plan-feature/SKILL.md` | Add hard-stop section, restructure steps for mandatory explore | MEDIUM |
| `.claude/skills/review-feature/SKILL.md` | Add hard-stop section, strengthen GWT mapping in matrix | MEDIUM |
| `.claude/skills/new-feature/SKILL.md` | Replace advisory GWT with hard-stop enforcement | SMALL |
| `.specify/templates/spec-template.md` | Update comment on acceptance criteria | SMALL |
| `.claude/CLAUDE.md` | Add orchestration discipline section | SMALL |

## Data flow

No runtime data flow changes. This modifies agent instruction files only. The information flow during skill execution:

```
User -> /plan-feature -> [read spec.md] -> Explore agent(s) -> explore results -> Design + Task agents -> plan.md + tasks.md
User -> /new-feature -> [conversation] -> GWT hard-stop gate -> spec.md
User -> /review-feature -> [read state files] -> Explore agent(s) -> GWT compliance matrix -> report
```

## Migration / rollout

No migration needed. Changes take effect immediately on next skill invocation. Rollback: `git revert` of the commit.

## Observability

Not applicable — markdown skill files, no runtime metrics. Verification is manual: run each skill and confirm behavior matches spec.

## Test strategy

| Scenario | Validation |
|----------|-----------|
| `/plan-feature` never reads source | Run on a test feature, inspect agent trace for disallowed tool calls |
| `/plan-feature` explore runs first | Verify explore agent launches before domain analysis in output |
| `/new-feature` rejects non-GWT | Provide free-form criteria, confirm skill blocks until rewritten |
| `/review-feature` GWT matrix | Run review on a feature with GWT criteria, verify matrix maps each scenario |

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Hard-stop too rigid — blocks reading legitimately needed config | Medium | Allowed-files list is explicit; can be expanded via `decisions.md` delta if needed |
| Mandatory explore adds latency on small features | Low | Explore agent is fast on small codebases; spec already notes this as edge case |
| Existing specs with non-GWT criteria break review | Low | `/review-feature` flags as MALFORMED rather than hard-failing |
