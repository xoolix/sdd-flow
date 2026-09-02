# Clarify — 026-gentle-ai-skills-tdd-archive-verify

Idea original (verbatim del usuario, `/sdd-new` 2026-09-01):

> Tres cosas que quedaron pendientes tras archivar la feature 025 (ver la memoria de Engram `sdd/026/backlog` y `sdd/archive/agent-bypassed-cli`).
> PRIMERO: adoptar cuatro skills de gentle-ai (Apache-2.0, © gentleman-programming) que YA ESTÁN ADAPTADOS Y ESCRITOS en /Users/santi/.claude/sdd-skill-drafts/ — work-unit-commits, comment-writer, branch-pr y chained-pr. Leerlos de ahí, no rehacerlos. Van a .claude/skills/<nombre>/SKILL.md. Obliga a agregarlos a CORE_SKILLS en bin/sdd:11, que es una lista fija: un skill que no figure ahí no se instala nunca y no avisa. Y obliga a agregarlos a la lista de ignorados de build-registry/SKILL.md, porque el test "build-registry ignores every core skill" exige que todo lo que esté en CORE_SKILLS aparezca ahí. Precedente de que corresponde que sean core: tdd, grill-me, diagnose-bug y prototype ya están en esa lista sin ser fases del pipeline.
> SEGUNDO: llevar el ciclo RED → GREEN → TRIANGULATE → REFACTOR a contrato de fase en implement-task, como hace gentle-ai. Debe quedar como requisito del agente y verificarse en su envelope, no depender de quien lo lanza.
> TERCERO (el más importante): cerrar el hueco de verificación post-archive. La 025 agregó una compuerta ANTES de archivar (.sdd-state con phase reviewed y veredicto de paso), pero NADA verifica DESPUÉS que el commit del archive contenga las dos mitades del move. Reprodujo dos veces (021 y 294ccfc archivando 025: 6 altas, 0 bajas, specs duplicados, sdd status archived, suite verde; solo lo agarró un chequeo manual). El arreglo: un test que corra git show --no-renames --name-status tras el archive y exija líneas D, más lo que haga falta para que el agente no pueda esquivar la CLI. Lección de fondo que conviene que quede escrita: la prosa que instruye a un LLM no es garantía ni cuando dice "no hagas exactamente esto"; lo único que funciona es verificar el efecto después.
> Restricciones permanentes: ningún commit lleva trailers Co-Authored-By ni footers de atribución de IA. No pushear ni abrir PRs sin go-ahead explícito. Todo contra integration/sdd-020-021, nunca contra main. bin/sdd shell puro (grep -c 'node\|npx\|src/' bin/sdd = 0) y grep -rn 'auto-commit' bin/ .claude/ .specify/ tests/ = 0, títulos de test incluidos.

## Step 0 — code-resolved

- `code-resolved: specs/ + specs/archive/` — próximo número es 026; cero features activas, archive termina en `2026-09-01-025-pipeline-state-integrity`.
- `code-resolved: ~/.claude/sdd-skill-drafts/` — los 4 drafts existen, completos, con atribución Apache-2.0, cada uno `<nombre>/SKILL.md`. `branch-pr` referencia ADR 0002/0004 con links relativos `../../../docs/adr/` que resuelven desde `.claude/skills/branch-pr/`. `hallazgos-verificados.md` acompaña como research.
- `code-resolved: bin/sdd:11` — `CORE_SKILLS` es una string space-separated en una línea; el test `sdd.test.js:3023` la parsea con `/^CORE_SKILLS="([^"]+)"/m` y exige cada entrada backticked en `build-registry/SKILL.md` (la lista de ignorados está en su Step 1, línea 18).
- `code-resolved: .claude/agents/sdd-implement-task.md:54-83` — RED→GREEN→REFACTOR ya es hard rule del agente (TDD detection + TDD quality bar + test-first gate en Step 4b). Lo que NO existe: el paso TRIANGULATE, y un campo del envelope que obligue a evidenciar el RED (hoy dice "paste the real RED output in Validations-Output **or the task notes**" — evidencia opcionalmente dispersa, no verificable por el orquestador).
- `code-resolved: .claude/agents/sdd-archive-feature.md:46-61` — Step 3.5 ya dice "Call exactly one sdd commit-slice … do not invent one" y corre en haiku; fue exactamente lo que el bypass ignoró (memoria #2198). La verificación del efecto no puede vivir en ese agente.
- `code-resolved: bin/sdd:1055-1080` — `--moved-from` funciona y stagea las bajas; tests existentes en `sdd.test.js:1159,1523,1582,1629` lo cubren a nivel commit-slice. Ningún test verifica el commit del archive DESPUÉS.
- `code-resolved: memoria Engram #2200 (sdd/026/backlog)` — el usuario ya definió que los tres pendientes son UNA feature ("Los tres pendientes de la próxima feature"), así que no se pregunta el split.
- `code-resolved: specs/` — no hay duplicados históricos vivos: el bypass de 025 ya fue reparado por 43e4843 y specs/ solo contiene archive/. verify-archive no necesita camino de limpieza histórica.

## Block 1+2 — Comportamiento / Scope del verificador post-archive

### Q: ¿Dónde vive la verificación post-archive del move completo (bajas en specs/<id>/ + altas en specs/archive/)?
Recommended answer: CLI + orquestador — nuevo subcomando shell `sdd verify-archive <feature-id>` (git show --no-renames --name-status sobre el commit del archive, exige ≥1 línea D bajo specs/<id>/ y altas bajo specs/archive/, falla si specs/<id>/ sigue trackeado en HEAD); lo corren sdd-next/sdd-auto como validación post-fase, el agente como self-check, y tests en repo temporal simulan el bypass.

> **lo mismo que hace gentle-ai**

**Mapeo verificado en el código de gentle-ai** (clonado en scratchpad, HEAD del 2026-09-01; `docs/testing-agents-deterministically.md`): su doctrina es literal — *"Gentle AI is deterministic code that validates agent work. The ceremony … moved into the CLI, because an agent … cannot be trusted to perform it honestly. A model asserting 'I verified it, it passes' is prose, not proof."* Tres piezas:
1. La ceremonia de verificación es **código determinista en la CLI**, nunca prosa del agente ni del orquestador.
2. El orquestador solo confía en el **exit code** de la CLI.
3. Un **E2E con agente real y razonamiento scripteado** prueba que la CLI acepta el trabajo honesto y rechaza el deshonesto (su suite Organic Runtime, `e2e/organicruntime/`).

Traducción a este repo = la opción recomendada: subcomando determinista en `bin/sdd` + orquestador que lo corre post-fase y confía solo en su exit code + test en repo temporal que scriptea el bypass real (commit directo con 6 altas 0 bajas) y exige exit ≠ 0.

## Block 1 — Contrato TDD (pendiente 2)

### Q: ¿Cuánto del patrón strict-tdd de gentle-ai adoptamos en implement-task?
Recommended answer: patrón completo — (a) TRIANGULATE en el ciclo con la regla default-obligatorio/skip-estructural, (b) campo TDD-Evidence obligatorio en el envelope (RED con output real de fallo, GREEN con output de pase, TRIANGULATE con N casos o skip anotado), (c) validación estructural post-fase en sdd-next/sdd-auto (campo ausente/incompleto = fase fallida → retry), (d) sdd-reviewer valida la evidencia contra la realidad (test existe, pasa ahora, tiene N casos), como `strict-tdd-verify.md` de gentle-ai.

> **Patrón completo (Recommended)**

Fuente verificada: `internal/assets/skills/sdd-apply/strict-tdd.md` (ciclo con TRIANGULATE paso 4, "MANDATORY for most tasks", mínimo 2 casos por comportamiento, skip solo puramente-estructural + única salida + nota explícita) y `internal/assets/skills/sdd-verify/strict-tdd-verify.md` (tabla "TDD Cycle Evidence"; tabla ausente = CRITICAL; GREEN se cruza contra la ejecución real).

## Block 2 — Wiring de los 4 skills (pendiente 1)

### Q: ¿Los skills quedan solo instalados o se cablean a las fases donde su juicio aplica?
Recommended answer: cableado liviano — instalar + dos punteros de una línea: sdd-implement-task.md Step 7.5 → work-unit-commits (elección de --files), sdd-archive-feature.md Step 3.6 → branch-pr/chained-pr (guía para el humano del PR gate). comment-writer solo instalado. Cero inyección vía registry.

> **Cableado liviano (Recommended)**

## Block 3 — Contrato CLI + ADR

### Q: ¿verify-archive solo como compuerta post-fase, o además sdd status detecta el síntoma (specs/<id>/ y specs/archive/*-<id>/ coexistiendo) como control permanente?
Recommended answer: ambos — la compuerta agarra el bypass en el momento; el status agarra el síntoma en cualquier momento posterior (habría agarrado 294ccfc con solo correr status).

> **Ambos (Recommended)**

### Q: ¿Formalizo la lección de fondo ("verificar el efecto, no confiar en la prosa") como ADR?
Recommended answer: sí, docs/adr/0005 — "Phase handoffs are verified by deterministic CLI checks, not agent prose"; cita los dos bypass reproducidos (021, 294ccfc) y la doctrina de gentle-ai como precedente externo.

> **Sí, ADR 0005 (Recommended)**

## Block 4 — Riesgos / edge cases (code-resolved)

- `code-resolved: bin/sdd (commit-slice --moved-from tests sdd.test.js:1159-1667)` — el camino legítimo produce D+A; el test nuevo de bypass debe usar `--no-renames` porque con rename detection git muestra `R100` en vez de `D`+`A` y el chequeo de líneas D daría falso negativo sobre un archive legítimo. Exacto motivo por el que el usuario pidió ese flag.
- Ambigüedad de id archivado en dos fechas (hallazgo codex sin verificar, `hallazgos-verificados.md:80`): verify-archive debe resolver el dir de archive más reciente o fallar con mensaje claro ante ambigüedad — no `find | head -1` silencioso. Decisión fina para el designer.
- verify-archive verifica por default el commit HEAD (el orquestador lo corre inmediatamente post-fase); una invocación directa posterior cae en el chequeo permanente de `sdd status` (duplicados), que no depende de qué commit fue.
- Aplica igual a fast-lane (quick-spec.md) — el move es el mismo shape de carpeta.
- Los 4 SKILL.md nuevos deben declararse en `--files` del slice que los agrega (commit-slice rechaza archivos nuevos no declarados — patrón Engram #2171-adjacent, y es el comportamiento deseado).
- Invariantes permanentes que ningún cambio puede romper: `grep -c 'node\|npx\|src/' bin/sdd` = 0 (shell puro, verify-archive incluido) y `grep -rn 'auto-commit' bin/ .claude/ .specify/ tests/` = 0 incluso en títulos de test.
- La feature 026 se archivará con su propia compuerta nueva activa — dogfood inmediato del verify-archive.

## Block 5 — Acceptance + rollback

### Q: Gate de calidad — 7 ACs en GWT, rollback por revert de slices, success metric (bypass detectado / legítimo aceptado / suite verde / greps en 0).
Recommended answer: los tres bloques como quedaron redactados en el gate.

> **OK, generá spec.md** (confirmado sin correcciones, 2026-09-02T01:26Z)

Los bloques validados quedaron verbatim en `spec.md` (§ Acceptance Criteria, § Rollback Plan, § Success Criteria).
