# Research Spike

## Metadata
- Research ID: R-003
- Topic: Lightweight flow for small changes (enhancements / fixes) in SDD
- Owner: santi
- Status: complete
- Linked feature: none (framework-level research)

## Brief
How should our SDD pipeline handle small work (fixes, minor enhancements, config) where the full 7-phase flow is overkill? How do Spec Kit, Kiro, BMad solve this?

## Why now
Our pipeline is tuned for medium/large features. For a 10-LOC fix, discovery + 3-agent voting wastes tokens. Without a fast lane, users bypass SDD (losing memory/decisions) or find it too heavy for daily work.

## Context gathered
Assumptions (no clarification round — topic well-scoped): audience is framework maintainer; "small" = single-domain, <~50 LOC, no arch impact; must preserve Engram + decisions trail.

## Questions
1. What criteria distinguish "small" from "standard" work?
2. How do other frameworks route small work? (flag, heuristic, classifier)
3. Which artifacts are mandatory vs skippable on the fast lane?
4. How does the fast lane re-join the main pipeline on scope growth?

## Options to evaluate
- **A. Status quo** — users run full pipeline for everything.
- **B. Fast lane skill** (`/sdd-quick <intent>`) — single consolidated spec, skip plan/tasks/simplify/review voting, keep Engram + decisions.
- **C. Bugfix-spec variant** (Kiro-style) — dedicated template with Current / Expected / Unchanged sections, then collapsed pipeline.
- **D. Auto-classifier** — LLM routes `/sdd-new` to full or tiny flow based on intent.
- **E. Phase-skip flags** — full commands with opt-outs (`--skip-discovery`, `--single-reviewer`).

## Evaluation criteria
- Token / latency cost for a 20-LOC fix
- Preserves audit trail (spec, decisions, Engram)
- Friction to invoke (cognitive + syntax)
- Scope-creep handling (small grows into medium)
- Implementation complexity in this repo
- Alignment with prior art

## Findings

### Prior art summary
| Framework | Fast-lane mechanism | Key idea |
|---|---|---|
| **BMad** | `Quick Dev`: fresh chat → intent → approve → review & push. `deferred-work.md` defers scope creep. | Narrow scope, one goal per run. |
| **Kiro** | `Bugfix Spec` with Current / Expected / **Unchanged** sections + property tests. `Design-first` for brownfield. | Constraint-based ("what must NOT change") reduces regression. |
| **Spec Kit** | No fast lane. Proposal `tinySpec` (#1174): single file context+plan+tasks, LLM-routed. | Community confirms full flow impractical for daily small work. |
| **Fowler critique** | All three criticized: 4 stories / 16 ACs for a minor bug ("sledgehammer on a nut"). | Scale-adaptive flows are an open gap. |

### Cost comparison (estimated, for a 20-LOC fix)
| Option | Phases run | Agents launched | Artifacts written | Relative cost |
|---|---|---|---|---|
| A. Status quo | 7 | ~8 (plan explore + 3 reviewers + adversarial + simplify + archive) | spec, plan, tasks, decisions, discovery?, .simplified, review-report | 1.0x |
| B. Fast-lane skill | 3 (quick-spec → implement → single-review) | 1–2 | single `quick-spec.md` + `decisions.md` | ~0.15–0.25x |
| C. Bugfix variant | 3 | 1–2 | `bugfix-spec.md` (C/E/U) + decisions | ~0.2x |
| D. Auto-classifier | variable | +1 classifier call | depends on routing | ~0.2–1.0x |
| E. Phase flags | 3–5 | 2–4 | full set, thinner | ~0.4–0.6x |

### Applicability to this repo
- `new-feature` 7-question gate: too heavy for a fix.
- `plan-feature` always runs Explore + Discovery Evaluator: wasted on known-cause fix.
- `review-feature` 3 reviewers + adversarial: overkill for 1-file change.
- `simplify-code` scopes via `git diff` — already cheap on small diffs; reuse.
- Engram `sdd/{feature-id}/...` keys + `decisions.md` delta merge — fast lane reuses cleanly.

### Escape hatch (scope growth)
BMad (`deferred-work.md`) and Kiro (Unchanged section) both suggest: if the agent finds scope grew, **pause and emit a "promote to full feature" signal** rather than silently expanding. Maps to our `Status: blocked` envelope.

## Recommendation

**Adopt Option B (fast-lane skill) with a Kiro-style bugfix template baked in.** Ship as two commands sharing one skill:

- `/sdd-quick <intent>` — small enhancement / refactor / config change.
- `/sdd-fix <intent>` — bug fix variant, uses Current / Expected / **Unchanged** template to lock regression surface.

### Proposed fast-lane pipeline
```
/sdd-quick or /sdd-fix
  → single conversational pass (≤3 questions: intent, acceptance, rollback)
  → write specs/NNN-kebab/quick-spec.md  (combines spec+plan+tasks, <300 words)
  → implement-task (existing skill, unchanged)
  → single-reviewer pass (1 agent, no voting, no adversarial)
  → archive-feature (existing, unchanged)
```

### Entry criteria (hard gate before skill accepts)
- Single domain touched
- No new dependencies / no schema migration
- No new public API surface
- User can state acceptance in ≤2 GWT criteria

If any fails → skill refuses and suggests `/sdd-new` (full flow). This mirrors BMad's Quick Dev scope guard.

### Escape hatch
If fast-lane `/implement-task` finds scope larger than expected, it writes `PROMOTE-TO-FULL` in `decisions.md` and returns `Status: blocked`. Orchestrator suggests re-running under `/sdd-new`. Prior work is preserved as context.

### Tradeoffs
| Pro | Con |
|---|---|
| ~75–85% token savings on small work | New skill to maintain |
| Keeps Engram + decisions trail intact | Misuse risk — entry gate mitigates |
| Bugfix template reduces regression (Kiro) | Two commands (`quick`, `fix`) vs single `/sdd-new` |
| Escape hatch prevents silent scope creep | Single reviewer = thinner safety net |

### Why not Option D (auto-classifier)
Adds an LLM call + misclassification failure mode. tinySpec is still unshipped in Spec Kit because routing is tricky. Explicit user choice is cheaper and deterministic.

## Next step
Run `/new-feature`: *"Add `/sdd-quick` and `/sdd-fix` fast-lane commands with entry gate and promote-to-full escape hatch"*. Scope: new skill, `sdd-continue` phase detection for `quick-spec.md`, `quick-spec-template.md` + `bugfix-spec-template.md`, CLAUDE.md routing update.

## Sources
- [BMad Quick Fixes](https://docs.bmad-method.org/how-to/quick-fixes/)
- [Kiro Bugfix & Design-first Specs](https://kiro.dev/blog/specs-bugfix-and-design-first/)
- [Spec Kit tinySpec proposal #1174](https://github.com/github/spec-kit/issues/1174)
- [Martin Fowler — SDD 3 tools comparison](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
