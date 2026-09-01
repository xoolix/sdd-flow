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
