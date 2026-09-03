# Clarify — 020-commit-per-slice-pr-gate

## Pre-answered (turnos del usuario en esta conversación, vía /sdd-new triage)

### Q: ¿Con qué granularidad querés los commits durante la implementación?
Recommended answer: Uno por slice — /implement-task commitea al final de cada tarea, después de que lint/types/tests pasan. Historial espejado con tasks.md. Aprovecha el gate de validación existente y arregla el scope de simplify-code.
> Uno por slice (Recomendado)

### Q: ¿El branch se pushea durante el desarrollo o recién al confirmar el PR?
Recommended answer: Push en cada commit (backup remoto, visible en CI; el PR sigue necesitando confirmación).
> Solo al confirmar el PR

### Q: Cuando confirmás el gate, ¿qué hace exactamente el flujo?
Recommended answer: Crea el PR en draft — gh pr create --draft con título y body armados desde spec.md + decisions.md. No dispara reviewers hasta que lo marcás ready.
> Crea el PR en draft (Recomendado)

### Q: ¿Cómo implementamos este cambio al framework?
Recommended answer: Vía /sdd-new lane full (dogfooding); el cambio es multi-dominio y pasa el risk screen.
> Vía /sdd-new, lane full (Recomendado)

## Step 0 — code-resolved (scan de esta sesión)

- `code-resolved: .claude/rules/git.md` — la política "Never commit or push. The human handles commits, merges, and PRs" vive SOLO acá. Ningún agente implementa git de escritura hoy; ni siquiera el "Create a branch when starting /implement-task" está implementado en ningún agente.
- `code-resolved: .claude/agents/sdd-simplify-code.md:45` — scope = `git diff --name-only <base-sha>..HEAD` (committed diff only). Bajo never-commit es siempre vacío → simplify nunca simplificó nada. Ya existe lógica `IGNORED_DIRTY` (línea 46) que advierte sobre paths sucios fuera del diff.
- `code-resolved: bin/sdd:844-849` — frescura del sentinel `.simplified` = `git-head: <SHA>` igual a `git rev-parse HEAD`. Cualquier commit posterior al sentinel lo vuelve stale.
- `code-resolved: .gitignore` — `.simplified` NO está ignorado (sí lo están `specs/**/.parent-branch` y `specs/**/.cross-focus.txt`).
- `code-resolved: .claude/skills/sdd-next/SKILL.md` (Rules, última línea) — "Never ask for user confirmation — launch phases and advance automatically". Conflicto directo con el gate.
- `code-resolved: .claude/skills/sdd-next/SKILL.md` Step 6 — "If the pipeline is complete (archive done) ... STOP". Archive es hoy el terminal del pipeline.
- `code-resolved: bin/sdd:870-878` — fases de `cmd_status`: missing / spec / planned / implementing / ready-to-simplify / ready-to-review / archived. `archived` → `next_command: "(none — feature archived)"`. Se detecta por `find specs/archive -name "*-<feature_id>"` (bin/sdd:766-771).
- `code-resolved: .claude/agents/sdd-implement-task.md` pasos 6/6b/7 — el checkbox de tasks.md, el marker `implemented-by:` y los deltas de decisions.md se escriben en ese orden; un commit por slice tiene que ir después del 7 para incluirlos.
- `code-resolved: tests/sdd.test.js:133-271` — el idiom de test para cambios en agents/skills es leer el `.md` y assertar sobre su contenido. Los tests de `bin/sdd` usan `execFileSync` contra un repo git temporal (`makeTempProject`, línea 9).

## Block 1 — Comportamiento

### Q: ¿El gate de PR va antes o después de /archive-feature?
Recommended answer: Después de archive — el PR incluye el archive move y el spec final con deltas mergeados, así el reviewer ve código + spec definitivo en un solo diff. Costo: /archive-feature debe commitear su propio move, y `sdd status` necesita distinguir "archivado pero sin PR".
> Después de archive (Recomendado)

### Q: ¿El auto-commit es siempre-on, o un knob configurable en git.md?
Recommended answer: Knob declarativo en .claude/rules/git.md (`auto-commit: on|off`), default ON si falta la línea, siguiendo el patrón ya establecido de `tdd: strict|off` en testing.md. Permite que un repo con hooks propios lo apague sin tocar agentes.
> Knob en git.md, default ON (Recomendado)

## Block 2 — Scope técnico

### Q: ¿Quién ejecuta el commit: cada agente vía Bash, o un subcomando nuevo de bin/sdd?
Recommended answer: Subcomando `sdd commit-slice` — centraliza staging explícito, mensaje y guardas (nunca `git add -A`, nunca push) en bash testeable. La regla crítica pasa de instrucción markdown que un sonnet puede ignorar a código con tests.
> Subcomando `sdd commit-slice` (Recomendado)

### Q: ¿Cómo decide `sdd commit-slice` qué archivos stagear?
Recommended answer: Lista explícita del agente (`--files a.js b.js`) + `specs/<id>/` siempre; el CLI rechaza el comando si no hay `--files`. Determinista y auditable: lo que no se nombra, no se commitea.
> Lista explícita del agente + specs/<id>/ (Recomendado)

## Block 3 — Contrato / datos

### Q: ¿Qué formato usa el mensaje de commit por slice?
Recommended answer: `NNN-feature: Tnnn <título>` — trazabilidad directa, respeta el imperativo sentence-case del historial actual, no impone conventional-commits a repos downstream.
> Conventional commits

### Q: ¿De dónde sale el `type` del conventional commit (feat/fix/refactor/chore)?
Recommended answer: Lo declara la task en tasks.md como campo nuevo `type: feat` junto a blocked_by/verifies/touches. Lo escribe sdd-task-planner, o sea revisable antes de implementar y determinista al commitear.
> Lo declara la task en tasks.md (Recomendado)

### Q: ¿Cómo sabe el pipeline que un feature archivado todavía no tiene PR?
Recommended answer: Sentinel `.pr-opened` en la carpeta de archive con la URL del PR; `sdd status` reporta fase `ready-to-pr` si falta y `archived` si está. Offline y determinista, mismo patrón que `.simplified`.
> Sentinel `.pr-opened` en el archive (Recomendado)

### Q: ¿Formalizo la decisión en docs/adr/0002-sdd-git-write-boundary.md?
Recommended answer: Sí, crearlo ahora con el contexto fresco — se revierte una política project-wide y se crea un boundary nuevo, mismo peso que el ADR 0001.
> Sí, crearlo ahora (Recomendado)
→ Creado en este turno: `docs/adr/0002-sdd-git-write-boundary.md`

## Block 4 — Riesgos técnicos

### Q: Si `sdd commit-slice` falla después de que las validaciones pasaron, ¿qué hace el slice?
Recommended answer: Revertir el `[x]` a `- [ ]` y devolver `Status: blocked` con el stderr pegado. Mantiene el invariante "task completa ⟹ commit existe", del que depende el scope de simplify-code. El retry con FORCE_TASK_ID ya existe en sdd-next.
> Revertir el `[x]` y devolver blocked (Recomendado)

### Q: Si al confirmar el gate falla `gh` (no instalado, sin auth, sin remote, o ya hay PR abierto), ¿qué pasa?
Recommended answer: Pre-flight (`gh auth status` + remote existe) ANTES de pushear. Si falta algo, no se pushea nada, se imprime el comando manual y no se escribe `.pr-opened` — el gate queda resumable. Si ya hay PR para el branch, reportar su URL y escribir el sentinel.
> Chequear antes de pushear, y degradar (Recomendado)

### Inferencia surfaced para corrección (no corregida por el usuario)
- `.simplified` debe agregarse a `.gitignore`. Hoy no está; si se commitea mueve HEAD y se auto-invalida (bin/sdd:844-849 compara su `git-head:` contra `git rev-parse HEAD`). Precedente: `specs/**/.parent-branch` y `specs/**/.cross-focus.txt` ya están ignorados por ser estado local.
- Orden load-bearing: commitear PRIMERO, escribir el sentinel DESPUÉS con el HEAD nuevo. El orden inverso produce un sentinel stale inmediato y `/sdd-next` rutea a `/simplify-code` en loop.

## Block 5 — Acceptance + rollback

### Q: ¿La acceptance exige una corrida dogfood real, o alcanza con los tests?
Recommended answer: Tests + dogfood como task [HITL]. Jest cubre `sdd commit-slice` end-to-end contra repo temporal y el contrato de `sdd status`; una task [HITL] final corre el pipeline sobre un feature chico real. Es el patrón que en 019 encontró los 3 highs que los tests no ven.
> Tests + dogfood como task [HITL] (Recomendado)

### Rollback (code-resolved en Block 1)
El knob `auto-commit: off` en `.claude/rules/git.md` es el rollback. `git.md` es per-project y `bin/sdd update` no lo pisa.

### Verificación de entorno (Step 0 extendido, esta sesión)
- `gh` 2.97.0 instalado en /opt/homebrew/bin/gh; `gh auth status` exit 0, cuenta santiliaudat, scopes gist/read:org/repo/workflow.
- remote origin = https://github.com/xoolix/sdd-flow.git
- `gh pr create` soporta `-d, --draft`. Happy path verificado como real en este repo.

## Quality gate — validado por el usuario
Los 3 bloques (6 acceptance criteria en G/W/T, rollback vía knob, success metric doble) fueron presentados y el usuario respondió "ok" sin correcciones.
