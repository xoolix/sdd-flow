# Feature: hello-world

## Summary
A trivial `bin/hello-world` executable bash script that prints `Hello, world!` to stdout and exits with status `0`. Its sole purpose is to serve as a deterministic, end-to-end smoke-test target for the SDD pipeline (specifically validating the 17 native sub-agents migrated in feature 008).

## Trigger
Manual CLI invocation by a developer from the repo root: `./bin/hello-world`.

## Happy Path
1. Developer runs `./bin/hello-world` from the repo root.
2. The kernel resolves the shebang `#!/usr/bin/env bash` and launches bash.
3. The script prints `Hello, world!` followed by a newline to stdout.
4. The script exits with status code `0`.

## Domains
- [ ] Database / storage
- [ ] API / backend
- [ ] Frontend / UI
- [ ] Infrastructure / deploy
- [ ] Auth / permissions
- [ ] Notifications / messaging
- [ ] External integrations
- [x] Other: CLI / scripts (`bin/`)

## Edge Cases
- **File not executable**: `bin/hello-world` is committed without the executable bit, so `./bin/hello-world` fails with `Permission denied`. Mitigation: ensure `chmod +x` is applied at file creation and the executable bit is preserved by git.
- **Bash unavailable via `env`**: `/usr/bin/env bash` fails to resolve `bash` on the host. Mitigation: rely on the standard POSIX-portable `#!/usr/bin/env bash` shebang; this is acceptable for the supported macOS + Linux dev environments.

## Acceptance Criteria
- [ ] **Given** the repo is checked out and `bin/hello-world` has the executable bit set, **When** a developer runs `./bin/hello-world` from the repo root, **Then** stdout equals exactly `Hello, world!\n` and the exit status is `0`.
- [ ] **Given** `bin/hello-world` exists in the repository, **When** `ls -l bin/hello-world` is run, **Then** the file mode includes the executable bit for the owner (e.g., `-rwxr-xr-x`).

## Rollback Plan
- `git revert` the commit that introduces `bin/hello-world`, or simply `rm bin/hello-world`. The file is isolated, has zero callers in the codebase, and removing it cannot break anything else.

## Success Criteria
- Running `./bin/hello-world` produces stdout exactly equal to `Hello, world!\n` and exit code `0` on 100% of invocations across supported dev environments (macOS + Linux). Equivalently: `[ "$(./bin/hello-world)" = "Hello, world!" ] && echo PASS` returns `PASS`.

## Open Questions
- None. Scope is intentionally minimal (smoke-test dummy).
