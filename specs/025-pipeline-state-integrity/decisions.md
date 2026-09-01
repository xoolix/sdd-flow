# Decisions

[2026-08-31] Origen: cross-review adversarial con codex (`codex exec`, sandbox read-only) sobre
test-sdd @ 7b61d89. Los diez defectos del spec fueron **reproducidos en vivo por mí** en un clon
descartable o confirmados leyendo el código — ninguno se aceptó por afirmación del reviewer. Uno de
los que codex reportó (`sdd doctor` abortando por `((n++))` bajo `set -e`) **no reproduce**: medido,
bash 3.2 no aborta y doctor contó bien las dos rutas. Queda fuera del alcance como bug.

[2026-08-31] DECISIÓN (usuario): el knob `auto-commit: off` se **borra entero**, sin ADR. Encadena
el no-op silencioso completo (nada se commitea → simplify ve scope vacío → escribe sentinel de éxito
→ archive reporta OK → imprime `git push` con HEAD vacío), que es exactamente el fallo histórico que
el `CLAUDE.md` documenta como lección aprendida — y `git.md` instruye al usuario a descomentarlo.
Alternativa descartada: conservarlo y hacer que simplify/archive/push se nieguen mientras el árbol
reviewado no esté commiteado. Más trabajo y deja el foot-gun.

[2026-08-31] DECISIÓN (usuario): el estado de fase pasa a un **archivo único `.sdd-state`** que
reemplaza a `.simplified`, con `phase`, `git-head`, `tree-digest`, `verdict` y `at`. `sdd status` lo
lee como única fuente. Resuelve V6 (frescura atada al árbol, no solo a HEAD) y V7 (existe estado
durable de "review pasó") con un mecanismo en vez de dos. Alternativas descartadas: un sidecar
`.reviewed` simétrico (deja dos archivos que sincronizar y un tercero latente), y escribir el
veredicto en `decisions.md` (parsear prosa para derivar estado — el antipatrón que este repo se
acaba de sacar de encima con `extract_section`, y no arregla V6).

[2026-08-31] DECISIÓN (usuario): **corte limpio**, sin shim de compatibilidad y sin migrar a mano la
feature 045 de medical-chat. Razón: `.simplified` solo guarda `git-head`, sin digest del árbol, así
que aceptarlo como válido durante una ventana de transición es reintroducir V6 — el bug que se está
arreglando. Costo aceptado: 045 re-corre simplify una vez.

[2026-08-31] DECISIÓN (usuario): el **harness determinístico de la máquina de estados entra en 025**,
completo — las cinco transiciones, no solo las que estos diez defectos tocan. Razón: es el veredicto
de codex sobre por qué los tests no agarraron nada de esto ("la suite SÍ ejecuta bin/sdd decenas de
veces; lo que no ejecuta es la máquina de estados"), y sin él los diez fixes dejan intacto el agujero
que los dejó entrar. Antecedente que pesó: los cuatro gaps de la lista de exclusión de simplify
vienen difiriéndose desde 023.

[2026-08-31] DECISIÓN (usuario): ante un archivo nuevo no declarado, `commit-slice` **falla duro**
(exit ≠0, sin commit), no solo avisa. Costo aceptado y explícito: cualquier archivo suelto sin
gitignorear bloquea todo commit del pipeline. Alternativa descartada: incluirlos en el warning que ya
existe para los tracked — fácil de pasar por alto en la salida de un agente, que es precisamente cómo
V1 sobrevivió.

[2026-09-01] `spec.md` queda en **842 palabras** contra un budget de 650 (corrige la nota previa que
decía ~690: era cierta antes del checkpoint, dejó de serlo al sumar el AC12, reescribir el AC11 y
agregar dos edge cases). Se recortó prosa dos veces (825 → 767 → 698) antes de que el checkpoint lo
volviera a subir. Lo que queda por encima son los **doce criterios de aceptación** —uno por defecto
verificado, más el harness, más la verificación del recibo en archive— y las seis edge cases, dos de
las cuales declaran límites que el checkpoint destapó y que callarlos sería peor que exceder el
budget: que el harness prueba lecturas y no ejecuta fases, y que el AC8 solo es aplicable en forma
débil. Bajar de doce criterios significaría dejar un defecto reproducido sin criterio que lo
verifique. Se deja explícito: un budget excedido y anotado es información; uno excedido y callado es
la clase de cosa que este repo viene puliendo.

[2026-09-01] DISCOVERY CHECKPOINT — cinco hallazgos de alto impacto; tres exigieron decisión del
usuario y se resolvieron (ver `discovery.md` § User decisions). Resumen de lo que cambió en el spec:

- **A: el AC11 estaba escrito sobre una premisa falsa.** Pedía que el harness "corriera
  plan→implement→simplify→review→archive con envelopes mockeados". No es construible: cada transición
  la ejecuta un agente LLM leyendo prosa, y `bin/sdd` no escribe nada que avance una fase —
  `detect_feature_phase` solo lee cuatro entradas. No existe ningún `runPhase()` que un test pueda
  llamar. Reescrito a lo que sí es verificable: el harness recorre las ocho fases con fixtures que
  reproducen el estado de archivos que cada fase deja atrás y afirma que `sdd status` reporta la fase
  correcta. Es un test de las LECTURAS de la CLI, y el límite queda declarado en el spec y en el
  comentario de cabecera del harness. Dato que lo justifica igual: hoy **ningún test** toca la rama de
  frescura del centinela (`bin/sdd:1107-1129`), que es donde vive V6.
- **E: `.sdd-state` lleva cinco campos, sin `files:`.** El `.simplified` actual guarda esa lista;
  nadie la lee, y los archivos que tocó simplify ya quedan en su propio commit — fuente mejor porque
  no puede mentir.
- **K (nuevo, lo levantó el checkpoint, no el spec): `/archive-feature` verifica el recibo.** Su
  pre-flight afirmaba "el review ya corrió con PASS" sin tener ningún archivo que chequear. Sin esta
  mitad, escribir el recibo lo deja sirviendo solo a `sdd status` y archive seguiría corriendo con un
  review salteado. Agrega un criterio de aceptación (ahora 12). Descartada la variante que solo avisa:
  misma clase de aviso fácil de pasar por alto que dejó vivir a V1.

Aceptados en bloque sin decisión, por ser trabajo y no disyuntiva: B (la rama de frescura sin
cobertura, que cubre el harness de A) y C (cinco sitios de `auto-commit` sin test que igual rompen el
AC5 — se reemplaza la ilustración del ADR 0003 por el knob `tdd:`, confirmado que existe en
`testing.md` con la misma forma). Los seis de impacto medio y bajo entran al plan como trabajo.

[2026-09-01] CROSS-CHECK plan↔tasks — seis defectos encontrados y corregidos antes de implementar.
Tres internos de `tasks.md`, tres de coherencia entre los dos artefactos:

1. **T004 apuntaba al artefacto equivocado**: decía que la rama actual debe ser `feature/<id>` "según
   `.parent-branch`". El sidecar guarda la rama **base** para scope de diff, no el nombre de la rama de
   la feature — que sale de la convención. Habría mandado al implementador a leer el archivo equivocado.
2. **T003 fusionaba los dos requisitos del AC3.** Decía "persiste la rama padre en un sidecar *en vez de*
   apilar en silencio", como si escribir el sidecar impidiera apilar. No lo impide. Separado en (a)
   escribir el sidecar y (b) avisar al apilar.
3. **La justificación de orden se contradecía en el primer slice.** Afirmaba que T001-T004 hacen seguro
   todo lo posterior, pero **el commit de T001 lo hace el `commit-slice` todavía roto**, y T001 crea un
   archivo de test nuevo — justo lo que la herramienta rota se traga. Anotada la compensación manual.
4. **`.gitignore` estaba en el plan y en ninguna tarea.** `.gitignore:5` tiene `specs/**/.simplified` y
   había que cambiarlo a `.sdd-state`. Sin eso el archivo nuevo queda untracked, y con el `commit-slice`
   endurecido de T001 **todo commit del pipeline falla**. El defecto más grave de los seis, y
   auto-referencial: la feature se habría bloqueado a sí misma.
5. **El plan creaba el subcomando `sdd state-write` sin tocar `usage()` ni el dispatch.** Misma clase que
   el hallazgo F8 de la feature 024, donde `usage()` describía mal a `domain-vocab` y el barrido no podía
   agarrarlo.
6. **Plan y tareas discrepaban en el orden del primer slice** — el plan decía "V2/V1/V4 primero", las
   tareas arrancan por V1. Unificado a V1→V2→V3→V4, con la aclaración de que ningún orden protege al
   primer slice: eso solo lo arregla la compensación manual.

Sexta feature consecutiva en la que este cross-check encuentra exactamente tres defectos de coherencia
(020, 021, 022, 023, 024, 025). Deja de ser anécdota: los artefactos generados en paralelo se
contradicen de forma sistemática, y el cross-check es lo que lo ataja.

[2026-09-01] Budgets excedidos y anotados: `tasks.md` 665 palabras (budget 530) y `plan.md` 954 (budget
800). `tasks.md` creció de 529 a 665 al aplicar las correcciones de arriba — un archivo de tareas
correcto vale más que uno corto, sobre todo cuando lo que se agregó es la advertencia que evita que la
feature se bloquee a sí misma. `plan.md` llegó a 930 desde el diseñador y subió a 954 con dos
correcciones de una línea.

[2026-09-01] T003: `sdd branch` writes `specs/<id>/.parent-branch` only when the sidecar does not
already exist — never overwrites. `plan.md` says "resolve the base and always write" the sidecar;
read narrowly that would mean re-running `sdd branch <id>` to switch back to an existing feature
branch rewrites the parent to "whatever branch we happened to be on just now", which is a strictly
worse failure than V3 (a plausible-looking wrong parent instead of an absent one). "Always" is
satisfied as "every invocation that switches branches attempts to ensure a parent is recorded",
not "every invocation overwrites". Verified: `.parent-branch` is already covered by
`.gitignore:3` (`specs/**/.parent-branch`), confirmed with `git check-ignore -v` — no `??` entry
from the sidecar, so T001's hardened commit-slice is unaffected.

[2026-09-01T12:48:53Z] implemented-by: claude

[2026-09-01] T004: the branch check accepts only `feature/<feature-id>`, not
`fix/<feature-id>`. `.claude/rules/git.md`'s "## Branch naming" section is an unfilled template
placeholder (`<!-- e.g. feature/NNN-description, fix/NNN-description -->`) inherited verbatim from
`.specify/templates/rules/git.md` — never instantiated for this project — and `cmd_branch` hard-codes
`feature/${feature_id}` with no `fix/` path at all; `git branch -a` confirms every branch this repo
has ever created is `feature/*`. Accepting `fix/` would have widened the gate on an unfilled example,
not an adopted convention. Detached HEAD (`git branch --show-current` prints empty) falls out of the
same equality check with no special case and fails closed — verified with a dedicated test rather
than assumed. Archive-time is unaffected: `sdd-archive-feature.md`'s Step 3.5 calls `commit-slice`
with `--moved-from` right after a plain filesystem `mv`, with no branch switch in between, so the
branch is still the feature's own.

[2026-09-01] T004: adding the branch check turned 20 of the 24 pre-existing `commit-slice` tests red,
plus none of the new ones I wrote. None of those 20 ever called `sdd branch` before `commit-slice` —
`makeTempProject()` leaves a fresh repo on whatever `init.defaultBranch` resolves to (`main` here),
and every one of those tests just committed straight from there. That gap in the tests is exactly
what let V4 (this task's own repro) go unnoticed: the suite never exercised the shape real usage
always produces (`/implement-task` always calls `sdd branch <feature-id>` first). Fixed by inserting
one `sdd branch 001-demo` call after each affected `seedCommit(project)`, matching real invocation
order; applied to all 24 (not just the 20 that strictly needed it) since a harmless extra branch
switch before a usage-error test costs nothing and keeps the treatment uniform. The one test with two
different feature dirs (`AAA`/`BBB`, this task's own V4-repro test) also needed a `.gitignore` with
`specs/**/.parent-branch` written into the fixture — without it, the second feature's own
`.parent-branch` sidecar is a genuinely untracked file the *other* feature's `commit-slice` doesn't
own, which trips T001's hard-fail before AC4 is ever reached.

## Delta: 2026-09-01 — Task T005

- **MODIFIED**: `plan.md`'s touched-areas row reads "`.gitignore:5` `.simplified` → `.sdd-state`",
  which a literal reading takes as a replacement. Implemented as an **addition** instead: `.gitignore`
  now lists both `specs/**/.simplified` and `specs/**/.sdd-state`, and the `.simplified` line is left
  untouched. Reason: four archived features (006, 007, 010, 018) under `specs/archive/` still carry a
  real `.simplified` file. Removing the line would un-ignore them, turning each into an untracked `??`
  entry that T001's hardened `commit-slice` would then refuse every commit over — including this
  task's own. Measured before implementing: `git check-ignore -v` confirms `.sdd-state` is ignored by
  the added line and `.simplified` remains ignored by the untouched one.
- **ADDED**: `tree_digest()` also gets called from `.claude/agents/sdd-simplify-code.md`'s pre-flight
  indirectly, via `sdd status $ARGUMENTS`'s `sentinel_fresh` field, rather than the agent hand-computing
  or hand-comparing `git-head`/`tree-digest` in prose. `plan.md` didn't specify this at the prose level;
  it follows the same "writer and reader share one computation" principle the digest helper itself is
  built on — a hand-rolled comparison in a `.md` file, read by an LLM, is exactly the kind of
  divergence-prone duplication `tree_digest()` exists to avoid at the CLI level. `sdd status` already
  exposed `sentinel_fresh` as a boolean field for this before T005; T005 only changed what that field
  reads and compares.
- Verified empirically before writing `tree_digest()`: `git stash create` returns a different SHA per
  call on an unchanged dirty tree (rejected); `mktemp`'s file must be `rm -f`'d *before* first use as
  `GIT_INDEX_FILE` — an existing empty file makes git fail with "index file smaller than expected"
  rather than starting a fresh index.
- Test fixtures for the new `sdd state-write` describe block needed their own local `.gitignore`
  (`specs/**/.sdd-state`) written before the seed commit — same self-invalidation trap as the
  production `.gitignore` change above, reproduced and confirmed via a first failing run before adding
  the fixture's `.gitignore`: without it, `.sdd-state` is an untracked file inside the temp project, so
  writing it changes the very tree digest it just recorded, and the freshly-written sentinel reads back
  as stale in the same test run.
- Pre-existing test `simplify-code commits before writing the sentinel and gitignores .simplified
  (T007)` (from an earlier feature) pinned the old `.simplified`-writing prose; updated in place to
  match the new `sdd state-write` call and both `.gitignore` lines — not a new test, since the behavior
  it pins legitimately changed under this task.

[2026-09-01] CROSS-CHECK, séptimo defecto (encontrado antes de lanzar T006): **ninguna tarea tocaba
`sdd-next/SKILL.md` ni `sdd-auto/SKILL.md`**, pese a que `plan.md` sí lista la fila `reviewed` de la
tabla de fases. Peor: esos dos archivos tienen **seis referencias vivas a `.simplified`** (cuatro y
dos) que, tras el corte limpio de T005, apuntan a un archivo que ya no existe — prosa que afirma un
comportamiento falso, en los dos archivos que gobiernan el pipeline. Se agregan al alcance de T006.
Es la misma clase de defecto que la feature persigue, encontrado dentro de la feature misma.

## Delta: 2026-09-01 — Task T006

- **ADDED**: AC7 only specifies the PASS case. T006 had to decide what `review-feature` does to
  `.sdd-state` on a reviewer conformance **FAIL** and on a judge block
  (`BLOCKED-JUDGMENT-DAY-HIGH`) — neither is in `spec.md` or `plan.md` at this level of detail.
  **Decision, asymmetric on purpose**:
  - **Reviewer FAIL** → Step 5 **clears** `.sdd-state` (same mechanism the old `.simplified`
    deletion used, just renamed) instead of writing `phase: reviewed, verdict: FAIL`. Chosen over
    "write FAIL and make `bin/sdd`'s next-command mapping verdict-aware" because `bin/sdd` only has
    four `--verdict` values (`PASS|PASS-WITH-WARNINGS|FAIL|none`, fixed by T005) and no way to tell
    a code-conformance FAIL apart from a judge-block FAIL if both wrote the same
    `phase: reviewed, verdict: FAIL` record. Clearing keeps `detect_feature_phase`'s `reviewed` case
    a plain, unconditional "next: archive" (as literally asked), and reproduces exactly what
    `.simplified`-deletion already did for the fix loop — no new bin/sdd complexity, no risk to
    T005's validated enum.
  - **Judge block** (reviewer PASS/PASS-WITH-WARNINGS + judge FAIL) → Step 6.5 **writes**
    `phase: reviewed, verdict: FAIL`, right before the `Status: blocked` return, so a fresh
    `/sdd-next` can see the block happened instead of re-running `/review-feature` blind. This was
    the actual ask ("a fresh `/sdd-next` after a judge block must still see what happened") and it
    is *only* satisfiable by writing something, never by clearing.
  - **Net effect — the distinction the old rule already drew ("do NOT delete `.simplified` for
    judge-only failures") is preserved, inverted**: because reviewer-FAIL now clears instead of
    writing, the combination `phase: reviewed, verdict: FAIL` can **only** ever be produced by a
    judge block. A fresh `/sdd-next` reading it never has to guess which case produced it — a
    downstream consumer (e.g. T007's archive pre-flight) can treat `reviewed`+non-passing-verdict as
    "blocked", and nothing here routes it into the automatic code-fix loop, which is exactly the
    "judge failures are a human decision, not automatic code-fix work" invariant the old rule was
    protecting.
  - Rejected: extending `cmd_state_write`'s `--verdict` enum with a fifth value (e.g.
    `BLOCKED-JUDGMENT-DAY-HIGH`) to make the two FAIL cases distinguishable inside `.sdd-state`
    itself. Deferred as unnecessary complexity — the clear-vs-write split above already makes them
    distinguishable using only the four values `plan.md` specifies, and `bin/sdd`'s own job stays
    "dumb": record phase/verdict, do not encode which orchestration branch to take next.
- **MODIFIED**: `detect_feature_phase`'s next-command mapping for `phase: reviewed` is
  **unconditional** — `/archive-feature <id>`, regardless of `verdict`. It does not special-case a
  `FAIL` verdict into a different suggestion. This is deliberate, not an oversight: `plan.md` and
  the task bullet both say "next command archive" with no verdict qualifier, and the real gate on a
  passing verdict is T007's own pre-flight in `sdd-archive-feature.md` (out of T006's scope,
  `blocked_by: T006`) — `bin/sdd status` is a hint, the phase skill's pre-flight is the enforcement,
  same layering already used for task-completion gates elsewhere in this pipeline.
- Tests: five of the seven new tests in `tests/sdd.test.js`'s "review-feature seals the verdict;
  bin/sdd gains the reviewed phase (T006/AC7)" block fail against pre-T006 `bin/sdd` and the
  pre-T006 skill `.md` files (proved by reverting those four files, re-running, then restoring —
  patch round-tripped clean); the other two (the FAIL-clears-state test and the fix-loop-still-
  routes-through-simplify test) pin behavior that was already true under T005's sentinel-absence
  fallback and pass on both sides — they document the design decision above rather than a new
  code path, since `review-feature/SKILL.md` is prose no CLI test can execute directly.

## Delta: 2026-09-01 — Task T007

- **ADDED — the decision T006 explicitly deferred**: T006's delta left `detect_feature_phase`'s
  `phase: reviewed` → `next_command` mapping **unconditional** (`/archive-feature <id>` regardless
  of `verdict`), reasoning that `bin/sdd status` is a hint and the real gate is T007's own
  pre-flight. T007 makes the mapping **verdict-aware** instead: `reviewed` + `PASS` or
  `PASS-WITH-WARNINGS` still proposes `/archive-feature`; any other verdict (`FAIL`, `none`, or an
  unrecognised value from a hand-run `state-write`) now proposes
  `(blocked — review verdict is <verdict>; a human decision is needed, see decisions.md)`.
  **Rejected**: leaving the mapping unconditional and only documenting the contradiction as
  acceptable layering. Rejected because `sdd status` is this pipeline's own primary state oracle,
  and 025 exists specifically to remove cases where the pipeline asserts state it doesn't have —
  a judge-blocked feature whose own status command still recommends the exact command its own
  archive gate refuses is that same defect class, just relocated from a file sentinel to a CLI
  field. The fix costs one nested `case` on a field (`verdict:`) `detect_feature_phase` already
  reads the sentinel file for when computing `state_phase` — reading it alongside is not new
  orchestration logic in `bin/sdd`, just reading one more line out of a file already open for the
  adjacent read. `bin/sdd` still does zero decision-making about *what to do* about a blocked
  feature; it only refuses to hand out a command that would fail. Verified live (fresh temp repo):
  `phase: reviewed` + `verdict: PASS` → `next_command: "/archive-feature 099-demo"`, full
  move+commit end-to-end still lands `phase: archived`; `phase: reviewed` + `verdict: FAIL` →
  `next_command` no longer names `/archive-feature` at all.
- **ADDED — receipt-check mechanism, not specified at this granularity in `plan.md`**: the
  pre-flight (`sdd-archive-feature.md`, replacing the old freeform "review has been run" check
  that had no file to verify against) resolves in two reads: `sdd status $ARGUMENTS`'s `phase`
  field for the reviewed-and-fresh determination (reusing `detect_feature_phase`'s existing
  HEAD+tree-digest freshness computation rather than having the agent hand-roll a second one in
  prose — same "writer and reader share one computation" principle T005's `tree_digest()` doc
  comment already states), then a direct `grep -m1 '^verdict: '` on `specs/$ARGUMENTS/.sdd-state`
  for the verdict, since `sdd status`'s JSON never surfaces `verdict` at all. `phase: reviewed`
  alone cannot distinguish a judge block from a passing review — both read `reviewed` — so the
  gate cannot be satisfied by `sdd status` output alone; verified this ambiguity exists before
  writing the gate text (see the "AC11: judge-block receipt" test).
- **ADDED — deletion ordering**: the old `.simplified` deletion in Step 3 (unconditional,
  immediately after the `mv`, before any commit) is retargeted to `.sdd-state` **and moved** into
  Step 3.5's "On success" branch, after `sdd commit-slice --moved-from` returns 0. Step 3 now
  explicitly says not to delete it. Reason: deleting the receipt before the commit lands means an
  interrupted or failed commit-slice call leaves an archived-looking folder with no receipt at
  all — exactly the "state the pipeline believes it has and doesn't have" class this feature exists
  to remove. Consequence, not a bug: when the `auto-commit: off` knob (T008 removes it) is set,
  Step 3.5 is skipped entirely and the receipt is never deleted — correct under the same ordering
  rule, since there is no successful commit to key the deletion off of, not an oversight.
- Tests: 10 new tests in `tests/sdd.test.js`'s "archive-feature verifies the .sdd-state receipt
  before archiving (025/T007/AC11)" describe block. Verified RED against pre-T007 code by
  `git stash`-ing `bin/sdd` and `sdd-archive-feature.md` only (keeping the test file) and
  re-running: 4 of the 10 failed as expected — the two `next_command`-verdict-aware tests (piece 3)
  and the two prose-wiring guards on `sdd-archive-feature.md` (pre-flight text, deletion ordering).
  The other 6 passed on **both** sides — they pin AC11 behavior (absent receipt, ready-to-review,
  verdict distinguishing via direct file read, PASS-WITH-WARNINGS validity, HEAD-moved staleness,
  and the move+commit mechanics) that was already correct under T005/T006's existing freshness and
  `state-write` machinery; T007 didn't have to change that code, only consume it from the archive
  gate. Honest limits: the two prose-wiring tests (`toContain`/ordering-index checks over
  `sdd-archive-feature.md`) prove the gate's instruction text exists and is ordered correctly —
  they cannot prove the haiku-tier agent actually obeys it at runtime, since that file is prose for
  an LLM, not executable code (same limit T006 and the spec's own edge cases already declare for
  this class of file). Re-verified live end-to-end after the change, in a fresh temp repo: a
  `reviewed`+`PASS` feature moves, commits (4 deletions + 4 additions for
  spec/plan/tasks/decisions.md, `.sdd-state` excluded from both sides by `.gitignore`), and reads
  back `phase: archived`; a `reviewed`+`FAIL` feature's `.sdd-state` is untouched by any of this
  and its `sdd status` now honestly refuses to suggest `/archive-feature`.

## Delta: 2026-09-01 — Task T008

- **ADDED — a repo-wide automated AC5 test, not just per-site assertions**: `plan.md`'s Test
  strategy already specified the shape ("AC5 = `grep -rn` en cero, con la aguja armada en
  runtime") but no such test existed before this task. Added
  `tests/sdd.test.js`'s "the commit-policy knob is deleted entirely (025/T008/AC5)" describe
  block with two tests: (1) runs `grep -rn <needle> bin/ .claude/ .specify/ tests/` via
  `execFileSync` and asserts empty stdout + exit 1, needle assembled at runtime via
  `["auto", "commit"].join("-")` so the test cannot trip its own grep; (2) asserts
  `docs/adr/0003-cli-resolves-content-agents-read-knobs.md` no longer claims both knobs "stay
  exactly as they are". This is deliberately the single test that protects all thirteen sites,
  including the five discovery flagged as having no other coverage at all
  (`sdd-designer.md`, `sdd-research-spike.md`, `plan-feature/SKILL.md`, `new-feature/SKILL.md`,
  `.claude/rules/domains.md`) — per-site assertions would have left the same gap discovery found
  (forgetting a site goes unnoticed until AC5 is checked by hand).
- **ADDED — one dangling reference beyond the 13 enumerated sites**: `sdd-archive-feature.md`'s
  haiku-tier constraint paragraph said "no conditional branching beyond the on/off knob above" —
  a phrase that only made sense while the knob-check sentence immediately above it still existed.
  Deleting that sentence (site (a), live resolution) left "the on/off knob above" pointing at
  nothing. Reworded to "no conditional branching beyond success/failure above", which is what the
  paragraph actually means now (the only remaining branch in that step is the commit-slice
  success/failure split). Not counted as one of the 13 sites in the task description — found while
  reading the surrounding paragraph before editing it, same as decisions.md's other cross-check
  entries for this feature.
- **Verified, not modified**: `.claude/rules/git.md` and `.specify/templates/rules/git.md` were
  byte-identical before this task (`diff` empty) and remain byte-identical after deleting the
  `## Auto-commit` section from both in this commit.
- Tests: proved RED against pre-T008 state with `git stash push -- <the 12 non-test source
  files>` (pathspec-scoped, so only those files' working-tree edits were stashed away; the 3 test
  files with the new/edited tests stayed in place), reran the two new tests: both failed for the
  expected reason (grep found the live occurrences across all 13 sites; the ADR line still read
  "stay exactly as they are"). Restored with `git stash pop`. Full suite: 139 (baseline) → 141
  (2 new AC5 tests), all green.

## Delta: 2026-09-01 — Task T009

- **ADDED — placeholder-line detection, not specified at this granularity**: `spec.md`/`plan.md`
  say the gate blocks on an "empty" `## User decisions`, but the schema `discovery.md` is written
  with (Step 4.5 in `plan-feature/SKILL.md`) leaves a non-empty placeholder line under that heading
  (`- (leave blank — user fills in DISCOVERY-ACCEPTED or DISCOVERY-DISCARDED entries)`). A gate that
  only checked "is the section non-empty" would never block, since the schema itself never emits a
  truly empty section. The instruction text explicitly names that placeholder line as not counting,
  so "empty" reads as "empty or unresolved," matching the actual artifact the pipeline produces.
- **ADDED — the Result envelope's "Blocked path" note, previously written for one blocking case
  only, now covers two**: it described only Step 4.5's fresh-`discovery.md`-with-high-impact-
  findings block. T009 adds a second block source (the Discovery resume check finding an existing
  `discovery.md` with no recorded decisions) and extends the same `Artifacts`/`Summary`/`Next`
  contract to cover both, rather than leaving the resume-check's blocked case without documented
  envelope shape.
- **Honesty scope, restated in the instruction text itself** (per the orchestrator's ceiling
  note): the gate proves *a* decision was recorded, never *per-finding* coverage — discovery
  findings carry no IDs anywhere (`sdd-discovery-evaluator`'s JSON contract, `discovery.md`'s bullet
  schema), so "one decision per high-impact finding" is not mechanically checkable. This matches
  discovery finding G and spec.md's own edge case; T009 states it inline in
  `plan-feature/SKILL.md` rather than only in `spec.md`, so the next reader hits the caveat at the
  point of use.
- Tests: 7 new tests in `tests/sdd.test.js`'s "plan-feature discovery gate blocks on empty
  ## User decisions (025/T009/AC8)" describe block. All are prose-wiring guards over
  `plan-feature/SKILL.md` — a `toContain` proves the instruction text exists and says the right
  thing, never that an agent obeys it at runtime (same limit already declared for this class of
  file by T006/T007 and by `spec.md`'s own edge cases). Proved RED with `git stash push --
  .claude/skills/plan-feature/SKILL.md` (test file left in place): 5 of 7 failed against the
  pre-T009 wording, for the expected reasons (existence-only resume language still present, new
  ceiling/blocked-path phrasing absent). The other 2 passed on both sides — one pins the
  already-correct resume-when-decided behavior, the other is a dogfooding check reading this
  feature's own `specs/025-pipeline-state-integrity/discovery.md` directly (independent of the
  skill file) to confirm its 4 `DISCOVERY-ACCEPTED` entries would satisfy the new gate. That
  dogfooding check needed one fix mid-flight: a plain string split on `"## User decisions"` grabbed
  the wrong section, because finding G's own prose mentions that exact heading text inline (as a
  citation, not a heading); switched to a line-anchored regex (`/^## User decisions$/gm`) taking
  the last match. Restored with `git stash pop`. Full suite: 141 (baseline) → 148 (7 new tests),
  all green.

## Delta: 2026-09-01 — Task T010

- **ADDED — exact gate placement, not specified at this granularity in `plan.md`**: `plan.md`'s
  touched-areas row for `sdd-simplify-code.md` said only "V9: bloqueo tras `:57` y antes del paso
  4" — a line-number anchor already stale before this task started (T005-T009 both edited this
  file). Located by heading/content instead: the block sits as a new sub-step `4b`, immediately
  after step 3's item 4 (`Record the remaining list as SCOPED_FILES`) and before item 5 (the
  empty-scope skip), so it always sees the final, post-exclusion-filter list and always runs
  before step 4 (Simplify) opens a single file.
- **ADDED — shared collection instead of a second `git status --short` call**: sub-step 2b already
  computed the raw dirty-path list to derive the notice-only `IGNORED_DIRTY`. Renamed that raw
  collection to `DIRTY_PATHS` and had the new 4b block intersect against it directly, rather than
  telling the agent to run `git status --short` a second time — one collection, two derived checks,
  so the two can't read the working tree at different moments and disagree.
- **MODIFIED**: the new 4b block intersects `DIRTY_PATHS` against `SCOPED_FILES` (the step-4 list,
  already passed through the exclusion filters), never against the step-2 pre-filter committed-diff
  list. Intersecting against the pre-filter list would have produced a false-positive block on a
  dirty test/lockfile/migration/config/SDD-artifact path that the filters would have dropped from
  scope anyway — exactly the false-positive risk flagged when this task was assigned.
- **MODIFIED**: Step 2's closing sentence ("This guarantees that any post-edit failure later is
  attributable to simplify-code, not a pre-existing regression.") was unconditionally false before
  this task — a scoped file already dirty at baseline time meant the baseline validation ran with
  that edit already mixed in, so passing there proved nothing about isolation. Reworded to state the
  guarantee only holds given the new 4b block, which is what actually delivers it (a run either
  reaches step 4 with no scoped file dirty, or blocks before step 4 touches anything — there is no
  third path where an edit happens against an already-dirty scoped file).
- Tests: 5 new tests in `tests/sdd.test.js`'s "simplify blocks on a dirty scoped file instead of
  committing or discarding it (025/T010/AC9)" describe block. All are prose-wiring guards over
  `sdd-simplify-code.md` — a `toContain`/`not.toContain` proves the instruction text exists and says
  the right thing, never that an agent obeys it at runtime (same limit already declared for this
  class of file by T006/T007/T009). Proved RED with `git stash push --
  .claude/agents/sdd-simplify-code.md` (test file left in place): all 5 failed against the pre-T010
  wording, for the expected reasons (no `4b` block, old unconditional guarantee sentence still
  present, `IGNORED_DIRTY` still computed as its own one-shot filter rather than derived from a
  named, reusable `DIRTY_PATHS`). Restored with `git stash pop`. Full suite: 148 (baseline) → 153
  (5 new tests), all green. The pre-existing pinned test for the SDD-artifacts exclusion-filter
  bullet (`Apply the same exclusion filters as \`SCOPED_FILES\``) was preserved verbatim inside the
  2b rewrite rather than reworded, since another test pins that exact substring.

## Delta: 2026-09-01 — Task T011

- **ADDED — a new `## Argument parsing` section, not specified at this granularity in
  `plan.md`**: `plan.md`'s touched-areas row said "V10: flags primero, id limpio hacia §I (**§I no
  se toca**...)" but didn't specify *where* the flag stripping should live in the file. Placed as
  its own section between `## Hard-stop: Orchestrator boundaries` and `## Pre-flight checks` — the
  earliest point in the file, so it runs before Pre-flight's `specs/$ARGUMENTS/tasks.md` reads and
  before every other step. Computes two values, mirroring `sdd-next`/`sdd-auto`'s own pre-loop
  extraction verbatim (same exact-token semantics, same "not substring match" phrasing): `FEATURE_ID`
  (the clean id) and `has_minimal_flag` (boolean). Every one of the six `$ARGUMENTS`-into-path/CLI/
  topic-key sites the task named (Pre-flight's two task-completion checks, Step 1.5's two state-file
  reads, Step 2.5's `decisions.md` append, Step 5's `.sdd-state` deletion) now reads `$FEATURE_ID`
  instead — plus every remaining site discovered by grep past Step 2 (Step 4's `sdd state-write`
  table, Step 5, Step 6.5's heading and `state-write` call, Step 6.6's heading, Step 7's Engram
  topic keys, the Result envelope's `Next` line, and Step 3's cross-reviewer prompt), since the bug
  class is "anything derived from raw `$ARGUMENTS` after flags exist in it," not only the specific
  six the repro hit first.
- **MODIFIED**: Step 2 ("Resolve review mode") no longer re-parses `$ARGUMENTS` — it consumes
  `has_minimal_flag` computed in Argument parsing. Removed the duplicate "Split `$ARGUMENTS` on
  whitespace" / "Check if the exact token `--minimal` is present" text that used to live there,
  since keeping two independent parses of the same string is exactly the kind of duplication that
  drifts. `plan.md`'s "V10: flags primero" phrasing is satisfied literally now — flags are parsed
  once, first, and every later step (including Step 2 itself) reads the already-computed result.
- **NOT modified**: `.claude/skills/_shared/sdd-phase-common.md` §I, per the task's explicit
  constraint (D-001/D-003: shared by four skills, three of which never receive flags). §I still
  documents lane resolution assuming an already-clean `<feature-id>`; `review-feature` now satisfies
  that assumption by feeding it `FEATURE_ID` instead of raw `$ARGUMENTS`, rather than teaching §I
  about flags.
- **Verified, not modified**: `sdd-next/SKILL.md` and `sdd-auto/SKILL.md` already extract
  `--minimal` correctly in their own pre-loop (exact-token match, feature-id resolved from the
  remaining tokens) and already pass the combined `<feature-id> --minimal` string to
  `review-feature` on both the initial dispatch and the re-review call inside their fix loops. No
  caller-side change was needed or made; `review-feature`'s fix handles the combined string
  identically regardless of which of the two call sites produced it.
- Tests: 6 new tests in `tests/sdd.test.js`'s "review-feature parses --minimal before resolving the
  feature path (025/T011/AC10)" describe block. `review-feature/SKILL.md` is prose an LLM follows,
  not executable code — every assertion is a wiring guard proving the instruction text exists and is
  ordered correctly, never proof an agent obeys it at runtime (same limit already declared for this
  class of file by T006/T007/T009/T010). Proved RED before writing the fix: 5 of 6 failed against
  the pre-T011 wording (`## Argument parsing` absent, path templates still read `specs/$ARGUMENTS/`,
  `state-write $ARGUMENTS` / `sdd/$ARGUMENTS` / `— $ARGUMENTS` still present, Step 2 still contained
  the literal "Split `$ARGUMENTS` on whitespace" duplicate); the sixth (the §I-untouched guard)
  passed on both sides since it only asserts the shared file was never touched. Full suite: 153
  (baseline) → 159 (6 new tests), all green. `grep -rn 'auto-commit' bin/ .claude/ .specify/ tests/`
  re-verified at 0 matches (unaffected by this task).

## Delta: 2026-09-01 — Task T012

- **ADDED — isolates the git-head-only freshness branch, not specified at this
  granularity**: `plan.md`'s Test strategy names the sentinel-freshness fork as one
  thing to cover, and the pre-existing `tests/sdd.test.js` staleness-via-HEAD test
  (T007) advances HEAD with a real file change (`unrelated.txt`), which moves
  `git-head` **and** `tree-digest` at once — it proves "a new commit invalidates",
  not that the `git-head` equality check is a genuinely separate branch from the
  `tree-digest` check inside `detect_feature_phase`'s `if`. T012 instead uses
  `git commit --allow-empty` for that half of the walk: it stages nothing, so the
  tree is byte-identical to what `.sdd-state` already recorded, and only `git-head`
  moves. This isolates the two `if` conditions from each other, which the mutation
  check below confirms matters: mutating just the `state_phase` case mapping (a
  different branch entirely) was enough to prove the harness has teeth, but the
  `--allow-empty` step is what actually exercises the head-equality check on its own
  rather than as a side effect of a tree change.
- **ADDED — re-seals mid-walk rather than only asserting staleness**: after each of
  the two freshness-breaking steps (uncommitted edit, then the empty commit), the
  walk restores `ready-to-review` before continuing forward (`git checkout --` for
  the first, a second `sdd state-write` call for the second) so the single walk can
  still reach `reviewed` and `archived`. Not specified in `plan.md`/`spec.md` at this
  level — a reasonable reading of AC12 would have made this two separate tests
  instead of one continuous walk. Kept as one test per the task description's
  "exercise it here as part of the walk," and because a single continuous walk is
  what actually proves the eight phases chain correctly end to end, not just that
  each phase is independently reachable from a hand-built fixture.
- **Verified via mutation** (per the task's own instruction, not part of the
  permanent suite): temporarily renamed the `reviewed` case in
  `detect_feature_phase`'s `state_phase` mapping (`bin/sdd`, the
  `case "$state_phase" in reviewed) phase="reviewed" ;; ...` line) to a typo
  (`reviewd`). Re-ran `tests/state-machine.test.js`: failed exactly as expected —
  `expect(s.phase).toBe("reviewed")` received `"ready-to-review"` instead, at the
  step 7 assertion. Restored `bin/sdd` from the pre-mutation copy; `git diff
  bin/sdd` empty afterward; full suite re-run green (160/160).
- Full suite: 159 (baseline) → 160 (1 new test — the whole eight-phase walk is one
  `test()`, matching AC12's phrasing of a single traversal rather than eight
  independent cases). `grep -rn 'auto-commit' bin/ .claude/ .specify/ tests/`
  re-verified at 0 matches (unaffected by this task; the new needle-check also
  passed over `tests/state-machine.test.js` itself, which is not in
  `sweep-retired-symbols.test.js`'s exclusion list).

[2026-09-01] NIT abierto para review: la cabecera de `tests/state-machine.test.js` cita **AC11**
("AC11 originally asked this harness to run plan→implement→simplify→review→archive with mocked
envelopes") cuando el criterio del harness es el **AC12**. La numeración se corrió durante el
discovery checkpoint, al entrar la verificación del recibo de archive como AC11 nuevo. Su primera
línea sí dice "025/T012 (AC12)", así que el archivo se contradice consigo mismo. Es un comentario
afirmando algo falso dentro del archivo cuyo tema es declarar límites con honestidad — pequeño, pero
exactamente la clase que esta feature persigue. Queda para que lo corrija simplify o el review.

## Simplify: 2026-09-01 — /simplify-code

- **Files simplified**: none (SCOPED_FILES reviewed, zero edits applied)
- **Scope**: `git diff --name-only 7b61d89..HEAD` (base `feature/024-remove-auto-pr`, 14 commits,
  22 files) filtered by the exclusion list left six files in scope: `.claude/rules/domains.md`,
  `.claude/rules/git.md`, `.specify/templates/rules/git.md`, `.gitignore`, `bin/sdd`,
  `research/hallazgos-verificados.md`. None of these matched `specs/**/*.md`,
  `.claude/skills/**/*.md`, `.claude/agents/**/*.md`, or `docs/adr/**/*.md`, so — as intended by
  the literal filter list, not by accident — two prose "rules" files, a template copy, and a
  research file were genuinely in scope alongside the code.
- **Reviewed, no change**:
  - `.gitignore`, `.claude/rules/domains.md`: single-line additions/edits from this feature, no
    redundancy to cut.
  - `.claude/rules/git.md` / `.specify/templates/rules/git.md`: byte-identical to each other by
    design (source rule vs. the template new projects are seeded from) — not a DRY violation to
    merge; the NEVER list also forbids merging concerns across files.
  - `research/hallazgos-verificados.md`: dense verified-findings record (V1-V10, N1); already
    tight, no wording is redundant, and this is a historical record of what codex found — cutting
    or rewording it risks losing the verified technical detail it exists to preserve.
  - `bin/sdd`: reviewed the full 525-line feature diff (state-write, tree_digest, validate_feature_id,
    the branch/commit-slice guards). One literal duplicate was found — `cmd_commit_slice` and
    `cmd_state_write` both hardcode the identical
    `error: invalid feature-id: "%s" (must not be empty, contain "..", contain "/", or start with
    "-")` printf. **Declined to extract**: `validate_feature_id`'s own doc comment states the
    design intent explicitly — "Prints nothing ... callers decide their own error text and exit
    code" — so the two call sites carrying the same text today is the validator's contract working
    as documented, not an oversight to DRY away. The rest of the diff (tree_digest's mktemp/rm-f
    ordering, the awk NR==FNR idiom, the branch/commit-slice guards) each carry a comment recording
    a specific empirically-confirmed gotcha (stash-create timestamps, real-index write-tree
    staleness, BSD awk `-v` newline rejection, mktemp corrupt-index quirk) — none of it is
    speculative or redundant, so none of it was touched.
- **Out of scope, left for review**: the AC11/AC12 NIT immediately above, in
  `tests/state-machine.test.js` — a test file, excluded by this phase's own NEVER list
  ("Never touch test files"). Flagged here, not fixed here.
- **T005/T006/T007 sentinel mechanism exercised live for the first time by this run**: pre-flight
  read `sdd status`'s `sentinel_fresh: false` (file absent) correctly; `sdd base-branch` resolved
  `feature/024-remove-auto-pr` via the `.parent-branch` sidecar exactly as expected; the dirty
  `decisions.md` (this file, already modified before this run started) never tripped T010's 4b
  block because it's excluded from `SCOPED_FILES` by the SDD-artifacts filter, and never appeared
  in `IGNORED_DIRTY` either, since it was already part of the committed `<base>..HEAD` diff — no
  false positive, no false negative. `sdd state-write 025-pipeline-state-integrity --phase
  ready-to-review` wrote the 5-field `.sdd-state` correctly (verified via `sdd status`:
  `sentinel_fresh: true`, `next_command: /review-feature ...`); the file stayed correctly
  gitignored (absent from `git status --short`). No discrepancy found between the live agent
  instructions in `.claude/agents/sdd-simplify-code.md` and this behavior.
- **Baseline**: pass (160/160 tests, `bash -n bin/sdd` clean; no lint/typecheck tooling configured
  in this repo — no eslint config, no tsconfig, no shellcheck installed) | **Post-edit**: SKIP (zero
  edits made — nothing to re-validate)

## Delta: 2026-09-01 — Post-T012 digest-scope fix

Post-implementation defect fix, found by dogfooding this feature (not a numbered task; all 12
tasks were already `[x]` and `/simplify-code` had already run). `tree_digest()` (`bin/sdd`) ran
`GIT_INDEX_FILE=<tmp> git add -A` over the whole worktree, so the digest included `specs/**` — the
pipeline's own bookkeeping. Consequence, measured live on this repo: `/simplify-code` sealed
`.sdd-state` with `tree-digest: 76f75084…`, then appended its run notes to
`specs/025-pipeline-state-integrity/decisions.md` (this file) — a write **under `specs/`**, not to
any code. `sdd status` immediately reported `sentinel_fresh: false`, `phase: ready-to-simplify`,
with HEAD unchanged, because the digest now included the just-appended decisions.md content. The
phase that seals the receipt (`/simplify-code`) is also the phase that writes `decisions.md`, so it
invalidated its own seal — running `/simplify-code` again would repeat this exactly, an infinite
loop.

- **MODIFIED**: `tree_digest()`'s scratch-index `git add -A` gains a pathspec exclusion —
  `git add -A -- ':(exclude)specs'` — so the digest covers the working tree except `specs/**`.
  Verified empirically on this machine (git 2.50.1): `:(exclude)specs` and the `:!specs` shorthand
  produce identical results; `:(exclude)specs` chosen for readability. Confirmed both directions
  before relying on it: an edit or new untracked file *under* `specs/` leaves the digest unchanged;
  a tracked-file edit or a new untracked file *outside* `specs/` still changes it. `bin/sdd` already
  assumes CWD == repo root elsewhere (`specs_dir="$(pwd)/specs"`), so the bare `specs` pathspec is
  consistent with that existing assumption, not a new one.
- **Accepted trade-off (user decision, restated from the assignment)**: an uncommitted edit to
  `spec.md` (or any file under `specs/`) no longer invalidates `.sdd-state`. Fine —
  `/review-feature` and archive's pre-flight both read the spec directly, not through the digest.
- **Writer/reader still share one computation**: both `cmd_state_write` and `detect_feature_phase`
  call the same `tree_digest()`, so the exclusion applies identically to writes and freshness reads
  — no risk of the two drifting into different notions of "the tree changed" (same principle T005's
  own doc comment states).
- **Repointed three pre-existing freshness tests** that dirtied a file *under* `specs/` to prove
  invalidation — with the fix, that no longer invalidates, so they'd have silently stopped testing
  freshness instead of failing:
  - `tests/sdd.test.js`: "writes .sdd-state ... an uncommitted edit invalidates it (AC6)" and "a
    reviewed state invalidated by an uncommitted edit falls back ... (T005 rule extends to
    reviewed)" — both now dirty a new tracked fixture file (`code.txt`, added to both local
    `makeReadyProject()` copies) instead of `specs/001-demo/spec.md`.
  - `tests/state-machine.test.js`'s eight-phase walk, step "6a. freshness fork, branch 1:
    uncommitted edit" — now dirties `t001-change.txt` (already tracked via step 4's commit-slice
    call) instead of `specs/{FEATURE_ID}/spec.md`.
  - The HEAD-staleness tests (committing after state-write; a new commit after review sealed it)
    needed no change: HEAD moving invalidates the sentinel before the digest branch is even
    checked, regardless of which file was edited.
- **Added three new tests** (`tests/sdd.test.js`, "sdd state-write (T005/AC6)" describe block)
  proving the fix explicitly in both directions: a new file appearing under `specs/` (e.g.
  `decisions.md`, the exact shape that deadlocked) does not change `tree-digest`; a tracked-file
  edit outside `specs/` still does; a brand-new untracked file outside `specs/` still does.
- **Proved RED first**: with the test changes in place but `tree_digest()` still unfixed, the new
  "appending to a file under specs/ does not change the tree-digest" test failed for the expected
  reason (`before`/`after` digests differed). Applied the one-line fix, reran: passed.
- **Verified against the actual deadlock, not just the temp-project fixtures**: reverted the test
  and `bin/sdd` files to HEAD, kept this feature's own dirty `decisions.md`, copied the fixed
  `bin/sdd` back in, and ran `sdd status 025-pipeline-state-integrity` live — `sentinel_fresh: false`
  (expected: the *stored* `.sdd-state` was sealed under the old, unfixed digest algorithm, so it can
  never match a digest recomputed under the new one — changing the algorithm invalidates receipts
  sealed before the change, which is correct, not a further bug). Re-sealed with
  `sdd state-write --phase ready-to-review` under the fixed code, then appended more prose to
  `decisions.md` again: `sentinel_fresh` stayed `true` — the deadlock is gone going forward.
- Full suite: 160 (baseline) → 163 (3 new tests), all green. `bash -n bin/sdd` clean.
  `grep -c 'node\|npx\|src/' bin/sdd` = 0. `grep -rn 'auto-commit' bin/ .claude/ .specify/ tests/` =
  0 (unaffected by this fix).

## Known open defect (not fixed) — `sdd-simplify-code.md` step 5 has no defined path for
"non-empty scope, nothing to change"

Found while diagnosing the digest-scope deadlock above; the same class of defect this feature
exists to remove, found inside the feature itself. Step 3 item 5 of `sdd-simplify-code.md` only
defines one branch: **"If `SCOPED_FILES` is empty → skip straight to step 6 ... Skip steps 4, 5, and
5.5"**. It says nothing about the other zero-work shape: `SCOPED_FILES` **non-empty** (files really
are in scope), but step 4 (Simplify) reviews every one of them and applies **zero edits** — no
domain-rule violation, no dead code, nothing KISS/DRY/YAGNI would touch.

This is exactly what happened on this feature's own `/simplify-code` run (see "## Simplify:
2026-09-01" above): six files were in scope (`.claude/rules/domains.md`, `.claude/rules/git.md`,
`.specify/templates/rules/git.md`, `.gitignore`, `bin/sdd`, `research/hallazgos-verificados.md`),
all reviewed, zero edits applied — then the run proceeded as if it had hit the *empty*-scope branch
(`Post-edit: SKIP`, `Commit: none`), which is only literally specified for the case where
`SCOPED_FILES` was empty to begin with. It landed on the right outcome (nothing to validate, nothing
to commit) by accident, not because the prose told it to — there is no instruction covering "scope
was non-empty, step 4 changed nothing, now what." Codex's cross-review (see the origin note at the
top of this file) had already flagged this exact gap as an unverified finding; it has now
reproduced live. Recorded here for `/review-feature` to pick up — not implemented in this pass.

## Simplify: 2026-09-01 — /simplify-code (re-run after digest-scope fix)

- **Why a second run**: the first `/simplify-code` pass (above) sealed cleanly, but the fix commit
  (`b5785e8`, "post-T012 digest-scope fix") landed afterward and moved HEAD, making the sealed
  `.sdd-state` stale for the correct reason (HEAD mismatch, not a bug). `sdd status` confirmed
  `sentinel_fresh: false` before this run and `phase: ready-to-simplify` — pre-flight's stale-sentinel
  path applied, no `rm` needed since the file was never re-created after the first run's own
  `/review-feature`-facing state was superseded by the fix commit continuing to build on the same
  branch.
- **Scope**: `git diff --name-only 7b61d89..HEAD` (base `feature/024-remove-auto-pr`, still resolved
  by `sdd base-branch`) now spans 16 commits / 27 files (one commit and ~5 files more than the first
  run, from the digest-scope fix). Same exclusion filters produced the **same six files** as the
  first run: `.claude/rules/domains.md`, `.claude/rules/git.md`, `.specify/templates/rules/git.md`,
  `.gitignore`, `bin/sdd`, `research/hallazgos-verificados.md`. The fix commit's other three changed
  files (`decisions.md`, `tests/sdd.test.js`, `tests/state-machine.test.js`) are excluded by the
  SDD-artifacts and test filters, same as before.
- **New material reviewed**: only `bin/sdd` had a real diff since the first run's review (confirmed via
  `git diff --name-only 30e3167..HEAD` on all six scoped files) — the `tree_digest()` fix itself: one
  line changing `git add -A` to `git add -A -- ':(exclude)specs'`, plus an expanded doc comment
  explaining the deadlock it fixes and the accepted trade-off (uncommitted `specs/**` edits no longer
  invalidate the receipt). **Declined to touch either.** The code line is already minimal — a single
  pathspec argument, nothing to collapse. The comment documents a specific empirically-reproduced
  gotcha (the self-invalidating-seal deadlock, verified live against the actual stuck receipt, per the
  "Delta: 2026-09-01 — Post-T012 digest-scope fix" entry above) exactly in the spirit of the other
  gotcha-comments in this file that the first run already declined to cut — trimming it would remove
  the only record of *why* the exclusion exists, which is exactly the kind of documentation this
  project's `CLAUDE.md` says ages well. The other five scoped files are byte-identical to the first
  run's review (verified via diff against `30e3167`) — that run's reasoning for leaving each alone
  stands unchanged.
- **Files simplified**: none (zero edits applied, same "non-empty scope, nothing to change" shape as
  the first run — see the "Known open defect" entry directly above, which already covers this; not
  re-recorded as a new finding).
- **Baseline**: pass (163/163 tests, `bash -n bin/sdd` clean; no lint/typecheck tooling configured in
  this repo) | **Post-edit**: SKIP (zero edits made — nothing to re-validate)
- **Commit**: none (nothing changed to commit)
- Sentinel re-sealed: `sdd state-write 025-pipeline-state-integrity --phase ready-to-review` under
  `git-head: b5785e8` (the fix commit); `sdd status` confirms `sentinel_fresh: true`,
  `next_command: /review-feature 025-pipeline-state-integrity`.

## JUDGMENT-DAY — 025-pipeline-state-integrity

| # | Severity | Category | Evidence | Description | Suggested Action |
|---|----------|----------|----------|-------------|------------------|
| 1 | medium | undocumented-assumption | `tree_digest` excluye `specs/**`; pre-flight de `sdd-archive-feature.md` | Editar `spec.md`/`plan.md` tras un review PASS y antes de archive es invisible al recibo; solo los checkboxes de `tasks.md` se re-verifican aparte. Archive puede archivar un spec que nunca se revisó. | Digest de contenido separado (spec/plan/tasks) capturado al sellar y comparado en el pre-flight de archive, o documentar el riesgo residual en `spec.md`. |
| 2 | medium | edge-case | `review-feature/SKILL.md` Paso 5 vs. 6.5 | El Paso 6.5 condiciona en "si el judge da FAIL" con el Final-verdict solo entre paréntesis. Con reviewer=FAIL **y** judge=FAIL, una lectura literal reescribiría `reviewed+FAIL` justo después de que el Paso 5 lo borró, rompiendo el invariante de que esa combinación solo significa bloqueo del judge. Sin test para esa combinación. | Reescribir la condición del 6.5 para depender explícitamente de `Final verdict == BLOCKED-JUDGMENT-DAY-HIGH`; agregar test reviewer=FAIL+judge=FAIL. |
| 3 | medium | incomplete-AC | `.claude/CLAUDE.md`; gate de veredicto en `sdd-archive-feature.md`; `sdd-hitl/SKILL.md` | La salida "aceptar el riesgo explícitamente" que promete el contrato del orquestador **no tiene mecanismo implementado**: `sdd-hitl` solo resuelve tareas `[HITL]`. Quedan solo arreglar-y-re-revisar o bloqueo permanente. | Definir el comando concreto con línea de auditoría, o angostar el texto de `CLAUDE.md` a las dos salidas que sí tienen herramienta. |
| 4 | medium | edge-case | AC1, chequeo de archivo no declarado; Edge Cases de `spec.md` | El fail duro no contempla subproductos legítimos de herramientas (snapshots, caches, artefactos de editor) aún sin gitignorear en un proyecto que recién adopta el framework. | Documentar que los proyectos adoptantes deben gitignorear artefactos generados antes de depender del gate; considerar un allowlist. |
| 5 | medium | undocumented-assumption | `research/hallazgos-verificados.md` vs. `decisions.md` | Un hallazgo de codex "sin verificar" reprodujo en vivo durante esta feature y se documentó solo en `decisions.md`, sin reconciliar el research doc. Otro de esa lista (completitud de archive ante fallo post-move) parece resuelto de rebote por T007, pero nadie lo verificó ni lo anotó. | Reconciliar el research doc: mover el reproducido a "reproducido/arreglado" con referencia cruzada; verificar o dejar anotado el de archive. |
| 6 | medium | edge-case | `decisions.md`, "Known open defect" | La rama "scope no vacío, cero ediciones" de `/simplify-code` no tiene instrucción definida y reprodujo dos veces, cayendo en el resultado correcto por improvisación del agente y no por instrucción. | Agregar la rama faltante: si `SCOPED_FILES` no está vacío pero se aplican cero ediciones, tratar igual que el camino de scope vacío. |
| 7 | low | incomplete-AC | Cabecera de `tests/state-machine.test.js` | Cita AC11 como criterio de origen cuando verifica el AC12; su propia primera línea dice "(AC12)", así que se contradice. | Corregir la referencia. |

Ningún hallazgo alcanza `high`: todos requieren una acción manual deliberada o una mala lectura de prosa que el contexto de ejecución ya permite evitar, y todos tienen mitigación sin pérdida de datos, seguridad ni migración irreversible.

Verificado en vivo por el judge: `npx jest` → 163/163.

Source: sdd-judge, review-feature phase
Date: 2026-09-01

[2026-09-01T16:26:00Z] Cross-Review: skipped — cross-agent failure: timeout (companion colgó dos
veces, 600000ms cada una, exit 143, sin stdout ni stderr). Los cuatro chequeos de pre-flight pasaron:
plugin registrado v1.0.6 con `installPath` válido, companion y schema en disco, `enabledPlugins` en
true, `codex` en PATH. Falla abierto por diseño — advisory, nunca bloquea la fase, y no consume el
presupuesto de reintentos de `review-feature`.

Diagnóstico que vale conservar: **`codex exec` invocado directamente SÍ funciona** — en esta misma
sesión produjo el cross-review adversarial que originó los diez defectos de esta feature. Lo que
cuelga es el wrapper `codex-companion.mjs`, no la CLI. Sospecha del agente: un prompt interactivo
(auth/login) esperando un TTY que no existe. Vale chequear `codex login` antes de confiar en el
cross-review automático de nuevo.

## T013: Review follow-up — closes JUDGMENT-DAY #6 and #7, plus the underlying gap

Four findings, all reproduced or verified live before being fixed — nothing accepted on the
reviewer's word alone (same standard as the rest of this file):

- **(a) `sdd-simplify-code.md`'s own `commit-slice` call omitted `--title`** — `cmd_commit_slice`
  has required `--type` and `--title` since T001 (`bin/sdd`'s `usage_msg`). A simplify run with a
  real, non-empty `SCOPED_FILES` following that prose verbatim would hit exit 2 before touching
  git, then follow the doc's own failure branch ("do NOT run `sdd state-write`... `Status: blocked`")
  forever — simplify could never commit a real change. Fixed: the documented call now reads
  `sdd commit-slice $ARGUMENTS --type refactor --title "<slice title>" --files <SCOPED_FILES...>`,
  matching the shape `/implement-task` and `/archive-feature` already use. Both other agents'
  documented `commit-slice` calls were checked against `cmd_commit_slice`'s real requirements too —
  `sdd-implement-task.md` and `sdd-archive-feature.md` already carry `--title`; no other mismatch
  found.
- **(b) Step 5's undefined branch** (JUDGMENT-DAY #6) — "non-empty `SCOPED_FILES`, step 4 applies
  zero edits" had no instruction; both real `/simplify-code` runs on this feature (see "Known open
  defect" entry above) reached the empty-scope outcome by agent improvisation, not by being told to.
  A literal reading of step 5.5 ("otherwise, call `sdd commit-slice`...") for that same shape would
  instead hit `cmd_commit_slice`'s "nothing staged" exit 5 and the doc's own "on failure ⇒ blocked"
  branch — two different outcomes from the same prose, reproduced live by the reviewer. Fixed: added
  `### 4.5. Zero edits applied`, explicitly routing this shape to the same outcome as the
  empty-scope path (`Commit: none`, `Status: success`, sentinel still written). The "Known open
  defect" entry above is superseded by this fix — left in place as the diagnostic record of how the
  gap was found, per this repo's own documentation stance on preserving *why*.
- **(c) `tests/state-machine.test.js`'s header cited AC11** (JUDGMENT-DAY #7) where the harness
  verifies AC12 (the file's own first line and `describe` title already said AC12 correctly — only
  the prose paragraph at line 11 was wrong). One-line fix, no test pinned the old string.
- **(d) No test verified any documented `sdd` invocation against the CLI's real usage** — the gap
  that let (a) survive review. Added `tests/documented-cli-usage.test.js`: it scans
  `.claude/agents/*.md` and `.claude/skills/**/SKILL.md` for backtick-delimited `sdd <subcommand>
  ...` spans with at least one argument/flag beyond the subcommand (a bare mention like `` `sdd
  commit-slice` exits non-zero `` is prose, not invocation syntax, and is excluded), substitutes
  placeholders (`$ARGUMENTS`, `$FEATURE_ID`, `<feature-id>`, `<type>`, `<slice title>`,
  `[--task Tnnn]`, `<SCOPED_FILES...>`, `<paths…>`) with real values, and executes each one against
  `bin/sdd` in a disposable temp git fixture. It found 11 unique documented invocations across 6
  files. One (`sdd-archive-feature.md`'s `--files <spec files touched by the delta merge>`) is
  resolved by omitting `--files` and relying on `--moved-from` — the prose itself documents that as
  the empty-deltas alternative, so the test exercises it rather than inventing fake paths; no
  candidate needed the explicit skip-list (none printed on this run, but the mechanism is real, not
  a hardcoded empty list — see the file's own comments). Assertion: exit code 2 fails a candidate
  (bin/sdd uses 2, only, for malformed arguments across every subcommand checked here — verified by
  reading `cmd_commit_slice`/`cmd_state_write`/`cmd_branch`); exit 1/3/4/5 are legitimate
  precondition gaps in the minimal fixture, not doc bugs, and are left alone.
  **Proved it has teeth twice**: written first against the *actual*, still-unfixed (a) — ran red (1
  failed: the `sdd-simplify-code.md` candidate, exit 2, `usage:` on stderr; 12 passed) before (a) was
  fixed, green (13/13) after. Then, per instructions, re-mutated the fixed line back to the buggy
  form and reran in isolation — red again, identical failure — then restored and reran full suite
  green. Full suite: 163 (baseline) → 176 (13 new tests: 2 scan-integrity tests + 11 per-candidate
  tests), all green.
- **Pinned-prose casualty, found by running the full suite, not anticipated**: `tests/sdd.test.js`
  pinned the exact pre-fix `commit-slice` line as a literal substring
  (`"sdd commit-slice $ARGUMENTS --type refactor --files <SCOPED_FILES...>"`). Updated to the
  corrected line. No other test pinned any string touched by (b) or (c) — checked by grepping for
  the changed phrases across `tests/*.test.js` before and after editing.
- `implemented-by` marker: skipped for this task — the immediately preceding line in this file is
  already `implemented-by: claude` (same runtime), and the dedupe rule is consecutive-only.
