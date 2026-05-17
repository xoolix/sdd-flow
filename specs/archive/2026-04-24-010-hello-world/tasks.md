# Tasks

## Execution order

### 1. Foundation
- [x] **T1**: Create `bin/hello-world` with shebang `#!/usr/bin/env bash` and a single line `echo "Hello, world!"`. File should be 2 content lines plus shebang.
- [x] **T2**: Apply executable bit: `chmod +x bin/hello-world`. Verify with `ls -l bin/hello-world` that mode contains `x` for owner.

### 2. Core implementation
- [x] **T3**: Stage the file so git records the executable bit: `git add bin/hello-world`. Confirm mode with `git ls-files -s bin/hello-world` — first field must be `100755` (not `100644`).

### 3. Validation
- [x] **T4**: Run the script and confirm stdout exactly equals `Hello, world!` followed by a newline. Command: `./bin/hello-world`. Expected output: `Hello, world!`.
- [x] **T5**: Confirm exit status is `0`. Command: `./bin/hello-world; echo "exit=$?"`. Expected tail: `exit=0`.
- [x] **T6**: Run the combined acceptance one-liner from plan.md: `[ "$(./bin/hello-world)" = "Hello, world!" ] && [ -x bin/hello-world ] && echo PASS`. Expected output: `PASS`.
- [x] **T7**: No docs update required (spec + plan + tasks are the documentation for this smoke-test dummy). No decisions.md entry required unless T1–T6 deviate from the plan.

## Notes
- Each task is atomic and independently verifiable.
- T1–T3 are the implementation. T4–T6 are the acceptance checks (each maps to a spec acceptance criterion or success criterion).
- No tests framework needed — this feature has no runtime logic; the acceptance one-liner in T6 is the full test surface.
- If any task deviates from the plan (e.g., switching from `echo` to `printf`), record the deviation in `decisions.md` before proceeding.
