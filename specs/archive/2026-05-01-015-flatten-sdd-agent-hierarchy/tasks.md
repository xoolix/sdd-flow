# Tasks — 015 Flatten SDD Agent Hierarchy

## Execution order

### 1. Foundation

- [x] **T01 — Create branch**: Run `git checkout -b feature/015-flatten-sdd-agent-hierarchy` from `main`.
- [x] **T02 — Backup orchestrator agents**: Copy `.claude/agents/sdd-plan-feature.md` and `.claude/agents/sdd-review-feature.md` to `.backup/` before any mutation. Verify both files present.

### 2. Core implementation

- [x] **T03 — Migrate plan-feature body**: Rewrite `.claude/skills/plan-feature/SKILL.md` with full orchestration body from `sdd-plan-feature.md` (Pre-flight, Explore, Discovery resume, Steps 1–7, result envelope). Add D-005 session guard: call `mem_context`; skip `mem_session_start` if session already active.
- [x] **T04 — Migrate review-feature body**: Rewrite `.claude/skills/review-feature/SKILL.md` with full orchestration body from `sdd-review-feature.md` (tier resolution, voter/adversarial spawning, Step 4.5, sentinel asymmetry D-004: SPEC-GAP-HIGH does NOT delete `.simplified`; FAIL does). Add D-005 session guard.
- [x] **T05 — Delete orchestrator agents**: Delete `.claude/agents/sdd-plan-feature.md` and `.claude/agents/sdd-review-feature.md`.
- [x] **T06 — Update sdd-next routing**: Edit `.claude/skills/sdd-next/SKILL.md` Step 3 — filesystem-side detection (D-001): if `.claude/agents/sdd-<phase>.md` absent → execute SKILL.md inline; if present → `Agent(subagent_type=<phase>)`. Remove orchestrator fallback (D-003). Preserve leaf fallback.
- [x] **T07 — Update sdd-auto routing**: Edit `.claude/skills/sdd-auto/SKILL.md` Step 2 with same branch logic as T06. Preserve `--minimal` re-application asymmetry and skill-registry caching differences.
- [x] **T08 — Audit 6 internal workers**: For each of `sdd-explore-agent`, `sdd-discovery-evaluator`, `sdd-designer`, `sdd-task-planner`, `sdd-reviewer-voter`, `sdd-adversarial-reviewer` in `.claude/agents/`: verify `disallowedTools: [Agent]` present, verify body prohibition literal present, update any docstring referencing `sdd-plan-feature` or `sdd-review-feature`.
- [x] **T09 — Update agent-frontmatter.md**: Edit `.claude/skills/_shared/agent-frontmatter.md` lines 35, 77–79 (D-006): update executor count (remove 2 orchestrators), invert policy documentation (orchestrators are now inline SKILLs).
- [x] **T10 — Update CLAUDE.md routing table**: Edit `CLAUDE.md` model routing table (D-007) — reword context column for rows that read "plan-feature sub-agents (Explore)" and "review-feature sub-agents" to reflect inline execution.
- [x] **T11 — Verify bin/sdd update (EC-1)**: Inspect `bin/sdd` update logic; confirm glob+cp does not recreate deleted agents locally. Document mitigation note.
- [x] **T12 — Write ADR**: Create `docs/adr/` next-numbered file `NNNN-flatten-sdd-agent-hierarchy.md`. Cover: problem, alternatives (including "fix recursion = not possible"), chosen approach, consequences (loss of model isolation; gain: coherence + bug fixed).

### 3. Validation

- [x] **T13 — SC-2 grep check**: Run `grep -rn "sdd-plan-feature\|sdd-review-feature" .claude/ docs/ bin/`. Expected: 0 hits outside `decisions.md` and ADR. **Result**: PASS — hits found only in (a) `agent-frontmatter.md:39` post-migration explanatory text; (b) `docs/adr/0001-...md` historical context (allowed by spec); (c) `.claude/settings.local.json:16-17` stale permission grants from T02 cp commands (non-functional noise).
- [x] **T14 — SC-3 grep check**: Run `grep -n "Agent(" .claude/agents/sdd-{explore-agent,discovery-evaluator,designer,task-planner,reviewer-voter,adversarial-reviewer}.md`. Expected: 0 hits. **Result**: PASS — 0 hits.
- [x] **T15 — E2E smoke (AC-5)**: Run `/plan-feature 014-fast-lane-visibility`. Verify `plan.md` + `tasks.md` produced, no `blocked` error, no fallback error. Apply EC-5 checkpoint: failures in 014 content do not count as orchestration failures. **Result**: PASS — main Claude orchestrated `plan-feature/SKILL.md` inline; spawned `sdd-explore-agent` (sonnet), `sdd-discovery-evaluator` (haiku), `sdd-designer` (sonnet), `sdd-task-planner` (sonnet) via Agent calls. Discovery returned `has_high_impact: false`. Designer produced `plan.md` (798w, under 800 budget). TaskPlanner produced `tasks.md` (380w, under 530 budget). 0 blocked, 0 fallback. EC-5 N/A — orchestration succeeded fully. Bonus: 014 unblocked.

## Notes

- T05 (delete) must come after T03 and T04 are fully validated — provides testing window.
- T13 and T14 are structural; T15 is functional. All three are hard-blocking (SC-1, SC-2, SC-3).
- Update `decisions.md` if implementation diverges from plan.
