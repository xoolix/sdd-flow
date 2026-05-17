# Research Spike

## Metadata
- Research ID: R-001
- Topic: Autonomous SDD Pipeline with Agent Coordination
- Status: complete
- Linked feature: N/A (infrastructure improvement)

## Brief
How to make the SDD pipeline more autonomous: agents resolve issues between themselves, human only intervenes for real decisions.

## Why now
Current pipeline requires human confirmation at every phase and sub-agents keep entering Plan Mode. The friction makes `/sdd-continue` and `/sdd-ff` barely faster than manual invocation.

## Questions
1. Can Teams or sub-agents enable agent-to-agent coordination without human mediation?
2. How to implement auto-correction loops (orchestrator validates → re-launches agent)?
3. Where should the human decision boundary be?

## Options

| Option | Description |
|--------|------------|
| A. Manual phases (spec-kit style) | Drop orchestrator, user invokes each phase manually |
| B. Autonomous sub-agents | Keep orchestrator, add validation + retry loops, remove unnecessary confirmations |
| C. Agent Teams with worktrees | Use Teams for parallel task implementation with peer-to-peer messaging |
| D. Hybrid B+C | Sub-agents for sequential phases, Teams for parallel implementation |

## Evaluation Criteria

| Criteria | Weight |
|----------|--------|
| Autonomy (less human friction) | HIGH |
| Robustness (no infinite loops, no Plan Mode) | HIGH |
| Complexity to implement | MEDIUM |
| Token efficiency | MEDIUM |
| Debuggability | MEDIUM |

## Findings

### What Claude Code supports today

| Capability | Sub-agents | Teams |
|------------|-----------|-------|
| Agent ↔ Agent messaging | No (hub-and-spoke only) | Yes (peer-to-peer by name) |
| Parallel file editing | No (same worktree) | Yes (separate worktrees) |
| Nested delegation | No (sub-agents can't spawn sub-agents) | No (no nested teams) |
| Shared state | None | Shared task list |
| Resume after completion | Yes (SendMessage by ID) | Yes (SendMessage by name) |
| Context isolation | Full (own context window) | Full (separate sessions) |

### Auto-correction loop pattern (validated by multiple sources)

```
Orchestrator launches sub-agent
    ↓
Sub-agent returns result envelope
    ↓
Orchestrator validates:
  1. Artifacts exist on disk?
  2. Lint + typecheck + tests pass? (parallel Bash)
  3. Result envelope complete?
    ↓
If FAIL → re-launch with error feedback (max 2 retries)
If PASS → proceed to next phase
If 2 failures → escalate to human with diagnosis
```

**Key anti-patterns to avoid:**
- Infinite loops: track fingerprints, cap retries at 2-3
- Context exhaustion: store state in files, not conversation
- Scope creep on retry: narrow the fix scope, don't re-do everything

### Human decision boundary

| Should ask human | Should NOT ask human |
|-----------------|---------------------|
| Spec questions (new-feature) | Phase transitions (plan → implement) |
| Architecture decisions (LARGE complexity) | Retry after lint/test failure |
| Review verdict presentation | File existence checks |
| Blocked status | SMALL complexity confirmation |
| First-time sdd-ff confirmation | Per-phase "¿Continúo?" in sdd-ff |

### Current pipeline fragilities (from codebase analysis)

| Issue | Severity | Fix |
|-------|----------|-----|
| Plan Mode activation | HIGH | Prompt engineering (done) + mode param |
| sdd-ff infinite loop on partial tasks | CRITICAL | Track attempts per task, cap at 2 |
| Orchestrator reads source code | HIGH | Stricter prompt boundary |
| Delta spec tracking is manual | HIGH | Automated diff in review |
| GWT validation is conversational | MEDIUM | Regex-based validation |

## Comparison Matrix

| Criteria | A. Manual | B. Auto sub-agents | C. Teams | D. Hybrid |
|----------|:---------:|:------------------:|:--------:|:---------:|
| Autonomy | Low | High | High | Highest |
| Robustness | Highest | High (with guards) | Medium | Medium-High |
| Complexity | Lowest | Medium | High | Highest |
| Token efficiency | Best | Good | Expensive (15x) | Expensive |
| Debuggability | Best | Good | Hard (parallel) | Hard |
| Parallel impl | No | No | Yes | Yes |

## Recommendation

**Option D (Hybrid)** — but implemented in two phases:

**Phase 1 (implement now):** Option B — Autonomous sub-agents with guards
- Remove unnecessary human confirmations from `sdd-continue` and `sdd-ff`
- Add validation layer after each sub-agent (artifact checks + lint/test)
- Add retry with error feedback (max 2 attempts per phase)
- Add loop detection in `sdd-ff` (track task attempts, cap at 2)
- Add `ESCALATED` status to result envelope
- Estimated effort: update 4 skill files

**Phase 2 (later, if needed):** Add Teams for parallel implementation
- Use Teams only during `/implement-task` when tasks are independent
- Each teammate gets its own worktree + branch
- Orchestrator merges branches after all tasks complete
- Only worth it for features with 4+ independent tasks

**Why not jump to Teams?** Teams use ~15x more tokens than sub-agents. The ROI only justifies Teams for large features with many parallelizable tasks. Most features will benefit more from removing friction (Phase 1) than from parallelism (Phase 2).

**Next step:** `/sdd-new` to spec the Phase 1 improvements to the SDD pipeline.
