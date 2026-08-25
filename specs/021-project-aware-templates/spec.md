# Feature: Project-aware artifact templates

## Summary
SDD's `.specify/` templates prescribe a web-app taxonomy that does not fit other project types. Fixed lists become sections derived from the project: real module names from the phase's Step 0 scan, enriched by `conventions.md` § Domain rules when it has content. Sections the project has no surface for become one explicit discard line.

## Trigger
Any phase writing an artifact from a template: `/new-feature` (spec), `sdd-designer` (plan), `/research-spike` (research).

## Happy Path
1. The phase reads `conventions.md` § Domain rules — content present → use that vocabulary; empty → derive names from its Step 0 scan.
2. It fills the domain section with real modules, no fixed checklist.
3. For a section the project has no surface for, it writes one discard line naming the reason.
4. `/init-project` fills § Domain rules with detected domains instead of the TODO placeholder.

## Domains
- [x] Other: `.specify/templates/` (spec, plan, research), `init-project`, `plan-feature` and `new-feature` SKILLs, `sdd-reviewer.md`, `conventions.md`, `tests/sdd.test.js`

## API Changes
| Surface | Change |
|---|---|
| `spec-template.md` `## Domains` | Fixed 8-item checklist → derived list of real modules. Name unchanged (`new-feature/SKILL.md:172` maps to it). |
| `plan-template.md` | `## Touched areas` drops `APIs/contracts` / `DB/schema` / `Jobs/workers` / `UI surfaces`. `## Observability` and `## Migration / rollout` become conditional with an explicit discard line when N/A. |
| `research-template.md` | `## Evaluation criteria`: vendor-selection list → criteria derived from what is evaluated. |
| `conventions.md` `## Domain rules` | Optional per-project vocabulary source; `/init-project` fills it instead of writing "Leave as TODO". |
| `plan-feature/SKILL.md` | "Fills in:" drops Observability / Migration from the mandatory list. |
| **Unchanged (parsed)** | `## Tasks`, `Summary`, `Acceptance Criteria`, `Rollback Plan` — read by four phases and by `extract_section` (`bin/sdd:905`). Renaming breaks 020's PR gate. |

## Edge Cases
| Case | Behavior |
|---|---|
| `conventions.md` empty / `/init-project` never run | Derive from the Step 0 scan. The common case — this repo's copy is headers only. |
| Section omitted that did apply | Prevented by the discard line: silence is indistinguishable from an oversight. |
| Same domain named differently across features | `conventions.md` is the shared vocabulary when present; otherwise accepted drift. |
| `sdd-reviewer.md:43` looks for missing observability | Must accept an explicit discard line as complete. |

## Acceptance Criteria
- [ ] Given a project with no database or frontend, When `/new-feature` writes `spec.md`, Then `## Domains` names real modules and contains none of the eight old fixed labels.
- [ ] Given `conventions.md` has content under `## Domain rules`, When a domain section is filled, Then it uses that vocabulary; Given it is empty, Then the agent derives from its Step 0 scan and the artifact is still complete.
- [ ] Given a project with no observability surface, When `sdd-designer` writes `plan.md`, Then `## Observability` is one explicit discard line with a reason — not empty, not silently absent.
- [ ] Given `/init-project` runs, Then `conventions.md` § Domain rules holds detected domains instead of the "Leave as TODO" placeholder.
- [ ] Given the changed templates, When `sdd open-pr` builds a PR body, Then `Summary`, `Acceptance Criteria` and `Rollback Plan` are still extractable by `extract_section`.
- [ ] Given 021's `plan.md` is regenerated with the new templates, Then `## Touched areas` names real modules of this repo and no inapplicable section remains as empty fields.

## Rollback Plan
- Revert the commit. Templates are symlinked to SDD_HOME, so every project reverts instantly — no `sdd update`.
- `conventions.md` edits are per-project and additive; `/init-project` keeps its "ask before overwriting non-template content" rule.

## Success Criteria
- 021's regenerated `plan.md`: zero `DB/schema`, `Jobs/workers` or `UI surfaces` as empty fields, and at least one explicit discard line.
- No artifact spends budget words on inapplicable taxonomy — 020's spec cost ~30 words on the eight checkboxes to land everything in "Other".

## Open Questions
- None.
