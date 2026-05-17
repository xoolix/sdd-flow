# Quick Spec: [name]

<!-- Fast-lane: enhancement / refactor / small change.
     Constraints: single-domain, no new dependencies, ≤2 GWT acceptance criteria.
     Combined spec + plan + tasks artifact. Word budget: ≤900 words. -->

## Summary
<!-- One paragraph: what changes and why -->

## Trigger
<!-- What initiates this? (user action, API call, cron, event, etc.) -->

## Happy Path
<!-- Step-by-step when everything goes right -->
1.

## Acceptance Criteria
<!-- REQUIRED: Given/When/Then format only. Maximum 2 criteria. -->
- [ ] Given [precondition], When [action], Then [expected result]

## Rollback Plan
<!-- How do we revert if something goes wrong? -->
-

## Success Criterion
<!-- One measurable indicator that the change is working -->
-

---

## Plan

### Touched files
<!-- Files / modules to change. NO new dependencies allowed. -->
-

### Approach
<!-- Concise description of the change strategy. Bullets preferred over prose. -->

### Test strategy
- Unit:
- Manual:

---

## Tasks
<!-- Vertical slice change list as `- [ ]` checkboxes.
     Format:
     - [ ] **T001 [AFK] Title**: demoable behavior
       - blocked_by: none
       - verifies: AC1
       - touches: modules/files/domains
     `/implement-task` flips these to `- [x]` upon completion (writes back to THIS file, NOT to a separate tasks.md).
     WARNING: the `## Tasks` header is IMMUTABLE — it is parsed by 4 downstream skills
     (implement-task, simplify-code, review-feature, archive-feature). Do NOT rename or nest it. -->
- [ ] **T001 [AFK] <title>**: <thin independently verifiable slice>
  - blocked_by: none
  - verifies: AC1
  - touches: <modules/files/domains>
