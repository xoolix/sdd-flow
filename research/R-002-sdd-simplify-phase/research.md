# Research Spike

## Metadata
- Research ID: R-002
- Topic: SDD simplify-code phase
- Owner: santi
- Status: complete
- Date: 2026-04-20
- Linked feature: (none — infrastructure / tooling)

## Brief
How to add a `simplify-code` step to the SDD pipeline that reduces complexity, redundancy, and over-engineering of code produced by `/implement-task`, without altering behaviour.

## Why now
Agent-generated code tends toward verbosity, speculative abstractions (YAGNI violations), dead code, and nested conditionals. The current pipeline jumps from `implement-task` → `review-feature`, so reviewers spend cycles complaining about clarity instead of spec conformance. A dedicated simplify phase between the two catches this as a separate concern.

## Context gathered
Assumptions (user did not clarify, so declared):
- Scope: TS/JS-leaning repo, but skill should be stack-agnostic (delegates style to project rules / compact skill registry).
- Target placement: after `implement-task` passes validation, before `review-feature` starts.
- Tone: behaviour-preserving only. No algorithmic rewrites, no API changes.

## Questions
1. Does a canonical "simplify" skill already exist that we can reuse or adapt?
2. Where does the phase fit in the SDD pipeline — post-impl, inside impl, or post-review?
3. How do we avoid over-simplification (clever one-liners, lost abstractions, dropped tests)?
4. How do we validate the step did not change behaviour?

## Findings

### 1. Prior art inventory

| Source | Kind | Scope | Reusable? |
|---|---|---|---|
| `anthropics/claude-plugins-official/plugins/code-simplifier` | Task agent | Recently modified files only, opus model, behaviour-preserving | **Yes — strongest base** |
| `anthropics/skills` — `simplify` | Skill (install via `npx skills add anthropics/claude-code`) | Parallel 3-agent review of changes, auto-fix | Yes — pattern source |
| `impeccable/simplify` | Slash command | Design/UX simplification, NOT code | No (wrong domain) |
| `claude-code-workflows/codebase-cleanup` → `refactor-clean` | Command | Deep SOLID/metrics refactor, may break API | Reference only — too aggressive for a pipeline step |
| `JordanCoin/codingskills` | Skill pack | KISS, DRY, YAGNI, SoC, Law of Demeter, Boy Scout | Reuse as **compact rules** injected by registry |

### 2. Pipeline placement — options

| Option | Runs where | Pros | Cons |
|---|---|---|---|
| A. Inside `implement-task` (REFACTOR step of TDD) | After GREEN, before commit | Zero new phase, tight loop | Already used by TDD; contaminates impl with style work; fights the executor boundary |
| B. **New phase between `implement-task` and `review-feature`** | After impl validation passes | Clean separation of concerns; orchestrator can re-run; reviewers judge simpler code | +1 phase in pipeline, +1 place to fail |
| C. Inside `review-feature` as a 4th reviewer | Parallel to conformance agents | No new phase | Reviewers should judge, not edit; mixes read and write |
| D. Post-review, pre-archive | After PASS | Only touches code that already passes | Changes code after it was approved — review becomes stale |

### 3. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Behaviour drift | Mandatory lint/types/tests re-run after phase |
| Churn causes stale review | Run **before** review; never during review-fix cycles |
| Over-simplification | Explicit NEVER list: no nested ternaries, no dropped exports, no merged concerns |
| Token cost | model=sonnet, scope = touched files only |
| Scope creep to deep refactor | Guard rails: no API change, no file moves, no dep swaps |

### 4. Principles to encode

Preserve behaviour · KISS (explicit > clever) · DRY on *knowledge* not incidental similarity · YAGNI (delete speculative abstractions, unused params, dead branches) · Clarity > brevity · Scope = files touched this feature · Fail loud on regression.

## Recommendation

**Adopt Option B**: add `/simplify-code` as a new phase after `implement-task` and before `review-feature`. Build the skill by adapting `anthropics/claude-plugins-official/plugins/code-simplifier` (behaviour-preserving, opus-pedigree) and injecting JordanCoin's KISS/DRY/YAGNI compact rules via the existing skill-registry mechanism.

### Integration sketch

```
implement-task (batch) → VALIDATE (lint/types/tests PASS)
    ↓
simplify-code (this feature's touched files only)
    ├─ apply KISS / DRY / YAGNI / clarity rules
    ├─ NEVER change public API, move files, swap deps, rewrite algorithms
    └─ VALIDATE again (same lint/types/tests MUST still pass)
          ├─ pass → continue
          └─ fail → revert diff, Status: blocked, report
    ↓
review-feature
```

### SKILL.md shape (concrete)

- Frontmatter: `name: simplify-code`, `user-invocable: true`, `arguments: feature-id`, `applies-to: simplify-code`.
- **Executor boundary** — does the work itself, no sub-agents (same pattern as `implement-task`).
- **Pre-flight**: all tasks `[x]`, last validation green, no `SPEC-GAP-HIGH` pending.
- **Scope**: `git diff --name-only` since branch start; skip tests and lockfiles.
- **Process**: read each touched file → apply principle checklist → write minimal diff.
- **NEVER**: change signatures, remove exports, rename public symbols, touch tests, change dep versions, reorder imports for style only.
- **Post-validation**: lint + typecheck + tests MUST pass; on fail → `git checkout` diff, return `blocked`.
- **Envelope**: `Status | Summary | Artifacts | Validations | Next: /review-feature | Risks`.
- **Model**: `sonnet` default.

### Orchestrator changes (`sdd-continue`, `sdd-ff`, CLAUDE.md)

- Phase detection table adds a row: `all tasks [x]` AND `simplified.flag` absent → next phase = `simplify-code`. Touch a `specs/<id>/.simplified` sentinel on success to avoid re-running.
- Model Routing table adds `simplify-code | sonnet`.
- Skill routing table adds `| Simplify after impl | /simplify-code |`.

### Tradeoffs accepted

- One extra phase adds ~1 sonnet call per feature — cheap vs. cleaner review and fewer nitpick-driven fix cycles.
- We deliberately skip the `refactor-clean` style deep SOLID refactor — that is a separate, human-initiated command, not a pipeline step.

### Next step
`/new-feature "add simplify-code phase to SDD pipeline"` — spec should list: skill contents, orchestrator changes (phase detection, model routing), sentinel file, failure/revert behaviour, and acceptance tests (feature runs pipeline end-to-end with simplify-code inserted and all validations green).

## Sources
- Anthropic code-simplifier agent: `github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md`
- Anthropic skills hub: `github.com/anthropics/skills`
- Coding-principles skills (KISS/DRY/YAGNI/SOLID/SoC/LoD): `github.com/JordanCoin/codingskills`
- GitHub Spec-Kit SDD phases: `github.com/github/spec-kit`
- Simon Willison on YAGNI for agents: `simonwillison.net/guides/agentic-engineering-patterns/code-is-cheap/`
- Impeccable `/simplify` (design-only, non-applicable): `github.com/anthropics/... marketplaces/impeccable`
