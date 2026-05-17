# Technical Plan — 006-fast-lane-commands

## Inputs

- Spec: `specs/006-fast-lane-commands/spec.md` (v2)
- Discovery: A5 (≤900w budget); B7 (manual-only invocation); B2 (writeback target = `quick-spec.md` Change list)
- Research: none — additive markdown-only changes

## Current state

| Skill | Key lines hardcoding `spec.md`/`plan.md`/`tasks.md` |
|---|---|
| `implement-task/SKILL.md` | Pre-flight 18–24; Step 2 line 44; Step 3 line 47; Step 4c line 55 (`- [x]` writeback to tasks.md) |
| `simplify-code/SKILL.md` | Pre-flight 17–18 (3-file check + all-[x]) |
| `review-feature/SKILL.md` | Pre-flight 33–35; Step 1 line 45; Step 2 lines 51–54 (inline content paste); Step 5.5 lines 214–216 |
| `archive-feature/SKILL.md` | Pre-flight 18; Step 1 27–31; Step 2 33–38 (delta merge into spec.md ×3) |
| `_shared/sdd-phase-common.md` | No fast-lane logic |
| `CLAUDE.md` | Skill routing table — no fast-lane rows |

## Proposed design

### Lane resolution (canonical snippet, centralized in `_shared/sdd-phase-common.md` §I)

```
if quick-spec.md exists AND plan.md absent:
    FAST_LANE=true; SPEC_FILE=quick-spec.md
elif plan.md AND tasks.md exist:
    FAST_LANE=false; SPEC_FILE=spec.md
else:
    blocked → suggest /plan-feature or /new-quick-feature
```

Each touched skill references §I inline (Engram-protocol-reference pattern).

### New artifacts

| File | Purpose |
|---|---|
| `.claude/skills/new-quick-feature/SKILL.md` | 3-Q gate → enhancement/refactor `quick-spec.md` |
| `.claude/skills/new-fix/SKILL.md` | 3-Q gate (C/E/U) → bugfix `quick-spec.md` |
| `.specify/templates/quick-spec-template.md` | Combined spec+plan+tasks (≤900w) |
| `.specify/templates/fix-spec-template.md` | Bugfix variant (Current/Expected/Unchanged) |

### Per-skill edits

| File | Hunks | Key change |
|---|---|---|
| `implement-task` | 4 | Pre-flight + Step 2 read + Step 3 domain source + **Step 4c writeback to `quick-spec.md` Change list (B2)** |
| `simplify-code` | 1 | Pre-flight only (diff scope is path-agnostic) |
| `review-feature` | 4 | Pre-flight + Step 1 read + Steps 2 & 5.5 inline-content swap |
| `archive-feature` | 3 | Pre-flight + Step 1 read + Step 2 delta merge target = `$SPEC_FILE` |
| `_shared/sdd-phase-common.md` | 1 | Add §I |
| `CLAUDE.md` | 2 | Skill routing rows + manual-only note |

Total: 12 edits + 2 skills + 2 templates + 1 shared + 1 CLAUDE.md.

## Data flow

```
/new-quick-feature or /new-fix
    → 3-Q gate → write specs/NNN/quick-spec.md (≤900w) + empty decisions.md
    → envelope: Next = /implement-task NNN

/implement-task NNN
    → pre-flight §I → FAST_LANE=true, SPEC_FILE=quick-spec.md
    → iterate Change list bullets as tasks
    → Step 4c flips - [ ] → - [x] inside quick-spec.md  ← B2

/simplify-code NNN  → §I → diff-based, unchanged
/review-feature NNN → §I → inline-paste quick-spec.md to agents
/archive-feature NNN → §I → delta merge into quick-spec.md
```

Full-flow features (`spec.md`+`plan.md`+`tasks.md`): §I falls through to `FAST_LANE=false`, behavior unchanged.

## Migration / rollout

Fully additive. No flags, no schema, no backfill. Rollback = `git revert` of one PR.

## Observability

| Signal | Where |
|---|---|
| Engram saves | `new-*-feature` Step 8 (topic_key `sdd/NNN/spec`); plan-phase save (`sdd/006/plan`) |
| Decisions log | `decisions.md` — implement-task writes deltas (unchanged) |
| B2 verification | Manual: post-`/implement-task`, all Change list bullets must be `- [x]` in `quick-spec.md` |

## Test strategy

| Test | How |
|---|---|
| E2E (new-fix) | `/new-fix "fix login redirect"` → `quick-spec.md` ≤900w, C/E/U present, `- [ ]` Change list |
| E2E (new-quick-feature) | `/new-quick-feature "add tooltip"` → AC ≤2 GWT |
| **B2 verification** | `/implement-task NNN` on fast-lane → assert all Change list bullets `- [x]` in `quick-spec.md`, NOT in `tasks.md` |
| Gate rejection | Multi-domain intent → `Status: blocked`, no `quick-spec.md` |
| Full-flow regression | All 4 edited skills on existing full-flow feature → 0 behavior change |

No automated tests — markdown-only.

## Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **B2 cascade**: Step 4c writes to wrong section in `quick-spec.md` | HIGH | Template uses distinct `### Change list` header; implement-task targets it explicitly. T19 verification task. |
| **Pre-flight desync** across 4 skills | MEDIUM | Centralized §I snippet; skills reference inline, single source of truth. |
| **Word budget overrun** | LOW | Quality gate checklist in both intake skills includes word count. Advisory. |
| **Folder collision** (both `spec.md` + `quick-spec.md`) | LOW | §I rule: `quick-spec.md` wins if `plan.md` absent; else full-flow. |
| **`sdd-continue`/`sdd-ff` skip fast-lane** | KNOWN/ACCEPTED | B7: manual invocation. Envelope `Next` field guides user. CLAUDE.md note documents limitation. |
