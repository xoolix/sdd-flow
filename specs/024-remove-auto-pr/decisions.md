# Decisions

[2026-08-31] DISCOVERY: dos hallazgos altos, ambos sobre el alcance no definido del barrido de AC5. Resueltos con una sola regla — barre `bin/`, `src/`, `.claude/**`, `.specify/templates/**`, `tests/**`; excluye `docs/` y `specs/`. Principio: se protege contra instrucciones y llamadas colgadas, no contra menciones históricas. Ver `discovery.md` para las once decisiones.
[2026-08-31] spec.md quedó en 690 palabras contra 650. Se registra en vez de recortar: lo que excede es el razonamiento del alcance de AC5 ("protege contra instrucción colgada, no contra mención histórica"), que es justamente lo que evita que el reviewer vuelva a derivar la contradicción que bloqueó el discovery. Sexto artefacto consecutivo por encima del presupuesto en esta familia de specs.
[2026-08-31T17:18:47Z] implemented-by: claude

## Delta: 2026-08-31 — Task T002
- **MODIFIED**: tasks.md assigned editing the "git.md policy" test (T013, `git.md rewrites the never-commit policy...`) to T004's prose pass. Stripping the PR-gate lines from `git.md`/its template seed in T002 (as T002's own bullet requires) makes that test's `sdd open-pr <feature-id>`/`draft` pins false immediately — leaving it red until T004 would break "suite green after every slice". Fixed the two dead assertions in T002 instead (dropped them, added `not.toContain("sdd open-pr")`), keeping the git.md prose change and its pinning test in the same commit. AC1/AC6 scope is unaffected; T004's own list of surviving prose-pinning tests (AI-attribution comment, simplify-code `.gitignore` assertion) is untouched and still its job.
