# Technical Plan

## Inputs
- Spec: `specs/010-hello-world/spec.md`
- Clarifications: none — scope is fixed (trivial dummy for SDD smoke-test)
- Research inputs: none

## Domain analysis
| Domain | Complexity | Notes |
|---|---|---|
| CLI / scripts (`bin/`) | SMALL | Single bash script, ~3 lines, zero deps |

**Strategy**: SMALL — direct execution, no decomposition, no checkpoints.

## Current state
- `bin/` exists and contains one precedent executable: `bin/sdd` (mode `-rwxr-xr-x`). This establishes the convention for scripts in this directory: POSIX-portable shebang, executable bit committed.
- No file named `bin/hello-world` exists. No references to `hello-world` anywhere in the repo.

## Proposed design
A single bash file `bin/hello-world` with three logical lines:
1. Shebang: `#!/usr/bin/env bash`
2. `echo "Hello, world!"` (echo appends `\n`, exit status `0` on success)
3. File committed with executable bit set (`chmod +x`)

No flags, no args, no options, no error paths beyond bash defaults. The script's sole contract is: write `Hello, world!\n` to stdout, exit `0`.

## Touched areas
| Area | Change |
|---|---|
| Files/modules | **Add** `bin/hello-world` (new, executable) |
| APIs/contracts | stdout contract: exactly `Hello, world!\n`; exit code `0` |
| DB/schema | none |
| Jobs/workers | none |
| UI surfaces | none |

## Data flow
`developer → ./bin/hello-world → kernel resolves shebang → bash executes echo → stdout receives "Hello, world!\n" → exit 0`.

## Migration / rollout
- **Backfill**: none (greenfield file).
- **Compatibility**: no callers to break.
- **Feature flags**: none needed.
- **Rollback**: `git revert` or `rm bin/hello-world`. Zero blast radius (zero callers).

## Observability
- **Logs**: stdout is the entire observable surface.
- **Metrics**: none.
- **Alerts**: none.

## Test strategy
| Level | Check |
|---|---|
| Unit | N/A (no logic to unit-test) |
| Integration | N/A (no dependencies) |
| E2E / manual | (1) `./bin/hello-world` prints exactly `Hello, world!` followed by newline; (2) exit status is `0`; (3) `ls -l bin/hello-world` shows owner-executable bit (e.g., `-rwxr-xr-x`) |

Automatable one-liner equivalent to the two acceptance criteria:
```
[ "$(./bin/hello-world)" = "Hello, world!" ] && [ -x bin/hello-world ] && echo PASS
```

## Risks and mitigations
| Risk | Likelihood | Mitigation |
|---|---|---|
| Executable bit lost in commit | Low | Run `chmod +x bin/hello-world` before `git add`; verify via `git ls-files -s bin/hello-world` (mode prefix `100755`) |
| Trailing-newline drift (printf vs echo) | Low | Use `echo` (adds `\n` by default); acceptance test compares via `$(...)` which strips trailing newline — matches spec intent |
| `env bash` missing on exotic host | Very low | Accepted per spec edge case; supported envs are macOS + Linux only |

## Notes
- Plan mirrors existing `bin/sdd` conventions (POSIX shebang, committed executable bit).
- No decisions.md entries needed unless implementation deviates from this plan.
