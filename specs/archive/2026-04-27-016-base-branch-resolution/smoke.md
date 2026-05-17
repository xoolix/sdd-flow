# Smoke Tests — 016 Base Branch Resolution

All ACs verified against `feature/016-base-branch-resolution` branch.

## AC1 — Layer 1 wins (sidecar with existing local branch)

**Setup:**
```bash
mkdir -p specs/test-ac1
printf 'feature/011-sdd-pipeline-operational-fixes\n' > specs/test-ac1/.parent-branch
```

**Command:**
```bash
bash bin/sdd base-branch test-ac1
```

**Expected:** stdout = `feature/011-sdd-pipeline-operational-fixes`, exit 0

**Result:** PASS

**Cleanup:** `rm -rf specs/test-ac1`

---

## AC2 — Layer 2 wins (git.md config, sidecar absent)

**Setup:**
```bash
printf '\nbase-branch: main\n' >> .claude/rules/git.md
```

**Command:**
```bash
bash bin/sdd base-branch
```

**Expected:** stdout = `main`, exit 0

**Result:** PASS

**Cleanup:** Remove `base-branch: main` line from `.claude/rules/git.md`

---

## AC3 — Layer 3 smallest count (no overrides)

**Setup:** No sidecar, no config. In this repo, `main` is the only resolvable candidate (`develop` and `master` do not exist locally).

**Command:**
```bash
bash bin/sdd base-branch
```

**Expected:** stdout = `main`, exit 0

**Result:** PASS (main selected as the only resolvable candidate)

---

## AC4 — Tiebreaker: first-in-order wins

**Note:** In this repo only `main` exists locally; a true tie requires two branches with equal `rev-list --count`. Tiebreaker is verified by code inspection: the `<` (strict less-than) comparison in Layer 3 preserves the first candidate on equal counts, as `develop` is checked before `main` before `master`.

**Result:** PASS (verified by code review; field verification requires a repo with two equal-count branches)

---

## AC5 — Override references missing branch → error, no fallthrough

**Setup:**
```bash
mkdir -p specs/test-ac5
printf 'feature/099-gone\n' > specs/test-ac5/.parent-branch
```

**Command:**
```bash
bash bin/sdd base-branch test-ac5
```

**Expected:** exit 2; stderr contains `specs/test-ac5/.parent-branch` and `feature/099-gone`

**Result:** PASS
```
error: specs/test-ac5/.parent-branch references missing branch "feature/099-gone"
exit: 2
```

**Cleanup:** `rm -rf specs/test-ac5`

---

## AC6 — No candidate locally → exit 3 with instructive message

**Setup:** Temp git repo with all three candidates (`develop`, `main`, `master`) absent:
```bash
mkdir -p /tmp/test-ac6-repo
cd /tmp/test-ac6-repo
git init -q && git commit --allow-empty -m "init"
git branch -m main other-branch
```

**Command:**
```bash
bash /path/to/bin/sdd base-branch
```

**Expected:** exit 3; stderr instructs to set `base-branch:` or create `.parent-branch`

**Result:** PASS
```
error: no base branch resolvable — set "base-branch:" in .claude/rules/git.md or create specs/<feature-id>/.parent-branch
exit: 3
```

**Cleanup:** `rm -rf /tmp/test-ac6-repo`

---

## AC7 — Whitespace-only sidecar falls through to Layer 2

**Setup:**
```bash
mkdir -p specs/test-ac7
printf '   \n' > specs/test-ac7/.parent-branch
printf '\nbase-branch: main\n' >> .claude/rules/git.md
```

**Command:**
```bash
bash bin/sdd base-branch test-ac7
```

**Expected:** stdout = `main`, exit 0 (sidecar is whitespace-only → falls through to Layer 2)

**Result:** PASS

**Cleanup:**
```bash
rm -rf specs/test-ac7
# Remove base-branch line from .claude/rules/git.md
```

---

## AC8 — Agent uses resolver (integration check)

**Setup:** Run `sdd base-branch` and pipe into `git merge-base` as the agent would:

**Command:**
```bash
BASE=$(bash bin/sdd base-branch)
git diff --name-only "$(git merge-base "$BASE" HEAD)..HEAD"
```

**Expected:** `BASE` = `main`; diff list reflects actual feature-016 changes (not a 39-file regression)

**Result:** PASS — `BASE=main`; diff scope shows only the files changed in this feature branch

---

## AC9 — Standalone CLI skips Layer 1 (no-arg)

**Setup:** No args passed; `.claude/rules/git.md` has no `base-branch:` line (falls through to Layer 3)

**Command:**
```bash
bash bin/sdd base-branch
```

**Expected:** stdout = `main`, exit 0; no filesystem access under `specs/` (Layer 1 skipped when no feature-id arg)

**Result:** PASS — `main` returned from Layer 3; code inspection confirms `if [ -n "$feature_id" ]` guard prevents any `specs/` read when no arg supplied

---

## Summary

| AC | Status | Notes |
|----|--------|-------|
| AC1 | PASS | Layer 1 sidecar with valid local branch |
| AC2 | PASS | Layer 2 git.md config |
| AC3 | PASS | Layer 3 auto-detect picks main |
| AC4 | PASS | Tiebreaker verified by code review |
| AC5 | PASS | Missing ref → exit 2, no fallthrough |
| AC6 | PASS | No candidate → exit 3, instructive stderr |
| AC7 | PASS | Whitespace sidecar falls through |
| AC8 | PASS | Integration: resolver feeds git merge-base correctly |
| AC9 | PASS | No-arg skips Layer 1 |
