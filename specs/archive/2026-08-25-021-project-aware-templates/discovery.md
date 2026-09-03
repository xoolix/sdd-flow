# Discovery Report
status: findings-present

Los dos high contradicen decisiones que tomaste en la entrevista. Cada uno lleva recomendación
para que decidas rápido. Para resolver: escribí bajo `## User decisions` como
`DISCOVERY-ACCEPTED: <F#> — <decisión>` o `DISCOVERY-DISCARDED: <F#> — <razón>`, y re-corré
`/plan-feature 021-project-aware-templates`.

## High-impact findings

- **[edge-case] F1 — La mitad "enriquecido por conventions.md" no tiene mecanismo.** Elegiste
  free-form + `conventions.md` cuando tenga contenido. Pero ningún sub-agente recibe
  `.claude/rules/*.md` ambientalmente, pese a que `CLAUDE.md:307` afirma que "Claude Code loads these
  automatically". La evidencia: los tres consumidores que existen leen el archivo **explícitamente**
  desde su propio prompt (`sdd-implement-task.md:75`, `sdd-simplify-code.md:96`,
  `sdd-archive-feature.md:46`, todos con `grep .claude/rules/git.md` para el knob `auto-commit`).
  `sdd-designer.md` —el agente que tendría que leer los dominios— no menciona `rules/` ni
  `conventions.md` en sus 52 líneas. `sdd-phase-common.md`, declarado como "shared rules for ALL SDD
  phase skills", no los menciona en 237 líneas; su §B "Project Standards" es otro sistema (compact
  rules del skill-registry, no `.claude/rules/`).
  **Decisión requerida**: ¿se le agrega a cada agente consumidor una instrucción explícita de lectura,
  copiando el patrón del knob `auto-commit`? ¿O el orquestador lee `conventions.md` una vez y lo
  inyecta en el prompt de lanzamiento, como ya hace con `sdd-phase-common.md`?
  _Recomendación_: instrucción explícita en el agente, copiando el patrón del knob. Ya está probado en
  tres agentes, no toca el orquestador, y funciona igual cuando alguien corre `/plan-feature` a mano.
  [impact: high]

- **[edge-case] F2 — El comentario del template no llega al plan.** Elegiste que la guía viva en el
  comentario HTML del template. Funciona para `spec-template.md` y `research-template.md`, que se
  copian literalmente (`new-feature/SKILL.md:165` "Copiá ... a specs/NNN/spec.md";
  `sdd-research-spike.md:31` "Copy ... to research/R-NNN-topic/research.md"). **No funciona para
  `plan-template.md`**: (a) hoy tiene CERO comentarios HTML —sus 10 secciones son listas de campos
  pelados—, así que no hay voz existente que imitar; (b) `sdd-designer.md:23` dice "Create plan.md
  **using** plan-template.md **as base**", nunca "copy"; (c) sus instrucciones reales de llenado son
  una lista hardcodeada duplicada en `plan-feature/SKILL.md:94-104` y en el propio `sdd-designer.md`.
  Un comentario agregado a `plan-template.md` no tiene lector garantizado.
  **Decisión requerida**: ¿la guía para el plan va en `plan-feature/SKILL.md` + `sdd-designer.md` (la
  superficie de instrucción real), aceptando que el mecanismo difiere por template? ¿O se cambia
  `sdd-designer` para que copie el template como hacen los demás, unificando el mecanismo?
  _Recomendación_: que difiera por template. Cambiar el designer a copy-then-edit es un cambio de
  comportamiento más grande, con más riesgo de regresión, para ganar una simetría que nadie observa.
  La guía del plan va donde el designer ya lee.
  [impact: high]

## Other findings

- [simplification] F4 — **La premisa del spec está parcialmente mal.** De 17 specs archivados: 1 usó la checklist como fue diseñada, ~10 colapsaron a `- [x] Other: <texto libre>`, ~5 inventaron etiquetas propias, 1 la borró. En research: 0 de 6 usaron la lista fija. Tasa de workaround ~94%. Los agentes YA ignoran la taxonomía — el problema no es que los bloquee, es que 16 features produjeron 16 vocabularios distintos. El valor del feature es **consistencia, no permiso**, lo que recuesta el peso sobre la mitad que F1 dice que no tiene mecanismo. [impact: medium]
- [edge-case] F3 — Los comentarios HTML nunca sobreviven al artefacto terminado: `spec.md` 0/11, `research.md` 0%, `tasks.md` 1/17 y parafraseado, `quick-spec.md` ~50% pero solo el meta-comentario de archivo. Los comentarios por sección se sobreescriben en el 100% de las muestras. La guía llega al agente en el momento del copy, pero es invisible para cualquier humano que lea el artefacto después. [impact: medium]
- [edge-case] F9 — De los templates que este feature modifica, solo `tasks-template.md` tiene cobertura de tests (2 hits). `spec-template.md`, `plan-template.md` y `research-template.md` no tienen ninguna assertion. El suite está en 42 tests / 992 líneas. [impact: medium]
- [edge-case] F5 — La línea de descarte inventa una cuarta sintaxis. Ya existen: (a) `N/A (razón)` a nivel campo, usada masivamente en planes archivados; (b) `N/A — <razón>` como valor de sección, en `new-feature/SKILL.md:180`; (c) `## Test-skip rationale` como heading en `decisions.md`. Conviene adoptar (a) o (b), no agregar una variante. [impact: low]
- [edge-case] F7 — **Una afirmación mía del spec probablemente sea falsa.** Puse como edge case que `sdd-reviewer` debe aceptar la línea de descarte. Pero `sdd-reviewer.md:43` audita la IMPLEMENTACIÓN (¿el código agregó logging?), no si `plan.md` tiene el heading, y no parece leer el plan sección por sección. El edge case puede estar resolviendo un problema inexistente. [impact: low]
- [reuse] F6 — `## Observability` y `## Migration / rollout` están presentes en los 12 planes archivados revisados, siempre llenos con "none"/"N/A". Valida la premisa para esas dos secciones: hoy cuestan una sección entera de placeholders. [impact: low]
- [reuse] F11 — `init-project/SKILL.md` ya tiene el guard exacto que el feature necesita: "If conventions.md already has non-template content, ask the user before overwriting", aplicado 3× más una regla resumen en `:115`. Copiarlo textual en vez de inventar redacción. Además `init-project` lanza el `subagent_type: "Explore"` nativo (no el `sdd-explore-agent` del proyecto) con un prompt de 10 puntos que junta estructura de directorios y entrypoints, pero nunca le pide explícitamente nombrar dominios funcionales. [impact: low]
- [reuse] F10 — Este repo ES SDD_HOME. `.claude/rules/conventions.md` es un solo archivo físico con dos roles: la copia de este proyecto y la semilla que `bin/sdd:232-241` copia a cada proyecto nuevo (salteando los que ya existen). `.claude/rules/` no es symlink. Editarlo acá edita la semilla. [impact: low]
- [edge-case] F8 — Los budgets de palabras no tienen enforcement en ningún lado: `grep "wc -w|word_count|budget"` sobre `bin/sdd` y `tests/` no devuelve nada. Todos son prosa. Aparte, `specs/020-.../spec.md` ya está en 665 palabras — breach preexistente, ajeno a este feature. [impact: low]

## User decisions
