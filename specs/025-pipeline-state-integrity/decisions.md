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
