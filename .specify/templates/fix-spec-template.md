# Fix Spec: [name]

<!-- Fast-lane bugfix. Kiro-style Current / Expected / Unchanged format.
     Constraints: single-domain, no new dependencies, ≤2 GWT acceptance criteria.
     Combined spec + plan + tasks artifact. Word budget: ≤900 words. -->

## Summary
<!-- One paragraph: what is broken, what the fix does -->

## Trigger
<!-- How is the bug reproduced? -->

## Current Behavior
<!-- What happens today (the bug) -->
-

## Expected Behavior
<!-- What should happen after the fix -->
-

## Unchanged Behavior
<!-- REGRESSION GUARD: behaviors that MUST continue to work as before. At least 1. -->
-

## Acceptance Criteria
<!-- REQUIRED: Given/When/Then format only. Maximum 2 criteria. -->
- [ ] Given [precondition], When [action], Then [expected result]

## Rollback Plan
<!-- How do we revert if something goes wrong? -->
-

## Success Criterion
<!-- One measurable indicator that the fix is working (e.g., error rate < X) -->
-

---

## Plan

### Root cause
<!-- Underlying cause of the bug -->

### Touched files
<!-- Files / modules to change. NO new dependencies allowed. -->
-

### Fix description
<!-- What changes to fix the bug. Bullets preferred over prose. -->

### Test strategy
- Unit (must reproduce bug before fix, pass after):
- Manual:

---

## Tasks
<!-- Vertical slice change list as `- [ ]` checkboxes.
     Format:
     - [ ] **T001 [AFK] Title**: demoable behavior or bug reproduction + fix
       - blocked_by: none
       - verifies: AC1
       - touches: modules/files/domains
     `/implement-task` flips these to `- [x]` upon completion (writes back to THIS file, NOT to a separate tasks.md).
     WARNING: the `## Tasks` header is IMMUTABLE — it is parsed by 4 downstream skills
     (implement-task, simplify-code, review-feature, archive-feature). Do NOT rename or nest it. -->
- [ ] **T001 [AFK] <title>**: <bug repro test plus minimal fix slice>
  - blocked_by: none
  - verifies: AC1
  - touches: <modules/files/domains>
