# Clarify — 023-silent-degradation-fixes

## Block 1 — Comportamiento

### Q: Los nueve ítems diferidos son heterogéneos, pero seis comparten forma: la herramienta se degrada en silencio (open-pr elige la base equivocada sin avisar; extract_section trunca y sale 0 así que nadie cae al fallback; `git add -- "$feature_dir"` se lleva ediciones ajenas sin warning; /archive-feature descarta deltas de plan.md; sdd-designer cae a findings que no existen). Los otros tres (O(n²) en la acumulación de awk, truncado en NUL, presupuesto del cuerpo del PR en bytes y no grafemas) son límites de robustez, no fallas silenciosas. ¿Qué hace este feature: los nueve, o solo la clase "falla en silencio"?
Recommended answer: los seis silenciosos + el de cobertura por ejes; afuera O(n²), NUL y Unicode. Los tres excluidos nunca se dispararon en uso real (`conventions.md` es un archivo a mano de decenas de líneas) y comparten mitigación: si pasan, se nota. Los silenciosos son lo contrario — ya pasaron y por definición no se notan. El de cobertura entra porque es lo que evita el cuarto ciclo sobre el mismo predicado.
dale, los seis silenciosos más el de cobertura

### Hallazgo del scan (code-resolved, no preguntado)
`cmd_base_branch` (bin/sdd:696) ya es un resolvedor completo de tres capas: sidecar `.parent-branch` → `base-branch:` en `.claude/rules/git.md` → autodetección (`develop`/`main`/`master`, gana el de menor count). Su ÚNICO llamador es el dispatch (`bin/sdd:1509`), o sea la línea de comandos. `cmd_open_pr` no lo llama y `gh pr create` va sin `--base`.
Segundo bug apilado: la capa 1 hardcodea `specs/${feature_id}/.parent-branch` en vez de usar `resolve_feature_dir`. Como `open-pr` corre por definición POST-archive, esa ruta ya no existe. Verificado: `sdd base-branch 022-pipeline-integrity-fixes` → `main`, con el sidecar vivo en `specs/archive/2026-08-26-022-.../.parent-branch` diciendo `integration/sdd-020-021`. Arreglar solo el llamado no alcanza: seguiría dando `main`.

### Q: De los seis silenciosos, tres son de pura corrección (fences en extract_section, deltas que archive no lleva a plan.md, vocabulario que el designer descarta): hay una respuesta correcta y hoy da otra. Los otros tres involucran una elección: qué hace la herramienta cuando genuinamente no sabe. El caso más filoso es la base del PR — hoy la capa 3 de cmd_base_branch autodetecta entre develop/main/master por menor cantidad de commits y devuelve eso sin decir que adivinó. Cuando open-pr no encuentra sidecar ni `base-branch:` en git.md, ¿qué querés que pase?
Recommended answer: que abra el PR contra la base autodetectada pero que la IMPRIMA, y que registre en `.pr-opened` la procedencia (`sidecar` | `git.md` | `autodetect`). No que se niegue. Negarse convierte un caso común (repo nuevo, sin sidecar, main obvio) en fricción, y open-pr ya es un gate con humano mirando. Lo que falló con 022 no fue que adivinara sino que no dijo que adivinaba: con `base: main (autodetect)` impreso, se agarra antes de crear el PR. Guardar la procedencia en `.pr-opened` lo hace auditable después, que es la diferencia con volver a confiar en que alguien mire la salida.
ok

## Block 2 — Scope técnico

### code-resolved
- `cmd_base_branch` capa 1 (`bin/sdd:701`): reemplazar el `specs/${feature_id}/.parent-branch` hardcodeado por `resolve_feature_dir`, que ya existe y ya hace el fallback a `specs/archive/*-<id>`. Arregla también `sdd base-branch` corrido a mano, no solo el llamado desde `open-pr`.
- Fences: van en `extract_section` (`bin/sdd:1020`), único punto compartido por `cmd_domain_vocab` y `build_pr_body_file`. Un arreglo cubre los dos consumidores.

### Q: El barrido del feature dir en cmd_commit_slice (`git add -- "$feature_dir"`, sin condición) existe por buena razón: cada slice se lleva sus artefactos sin que el llamador los enumere, y /archive-feature depende de eso. El problema es que una edición en curso adentro se cuela bajo un slice ajeno. ¿Lo arreglamos avisando o cambiando qué se stagea?
Recommended answer: avisar, sin tocar el staging. `cmd_commit_slice` ya toma un snapshot de lo pre-stageado (lo agregó el Fix 5 de 022 para el dirty-check), así que la información ya está en la función; reusarla para listar qué archivos del feature dir venían stageados de antes es barato y no toca la garantía de 020. Cambiar el staging es peor: no hay forma confiable de distinguir "edición ajena" de "decisión de HITL stageada a propósito", y equivocarse ahí DESCARTA trabajo en vez de solo mezclarlo; además romper el barrido rompe archive, su consumidor más dependiente.
avisar

## Block 3 — Contrato / datos

### code-resolved
`.pr-opened`: lo escribe `write_pr_opened_sentinel` (`bin/sdd:1137`) y su único lector (`bin/sdd:1240`) solo chequea EXISTENCIA, para que `sdd status` pase de `ready-to-pr` a `archived`. Nada parsea el contenido ⇒ agregar `base:` y la procedencia es aditivo y seguro.

### Q: Hoy el paso 2 de /archive-feature mergea los deltas ADDED/MODIFIED/REMOVED solo a `$SPEC_FILE`. Los judges de 021 y de 022 nombraron el mismo hueco: plan.md nunca se toca, así que una tarea descubierta durante la implementación (el T008 de 022) deja el plan describiendo un diseño que no se shipeó. ¿Qué hace archive con plan.md?
Recommended answer: que le APENDEE una sección al final listando los deltas, no que lo reescriba. Sale del CLAUDE.md del repo ("documentar el por qué envejece bien; documentar el qué envejece mal"): plan.md es el registro de lo que se decidió ANTES de construir, y reescribirlo para que coincida con lo que salió destruye la información valiosa — qué se planeó versus qué cambió al chocar con el código. Evidencia directa: el plan.md de 022 se enmendó a mano para T008 y después aparecieron cuatro frases obsoletas y 24 citas de línea derivadas en ese mismo archivo. Editar el plan a mano es lo que produjo la deriva; una sección apendeada mecánicamente no puede derivar.
dale con la reco

### CORRECCIÓN al Q anterior (después de mirar las referencias que pidió el usuario)
El usuario pidió mirar cómo lo resuelven spec-kit y gentle-ai. gentle-ai delega: sus artefactos viven en Engram o en **OpenSpec**, y OpenSpec es de donde salió el vocabulario ADDED/MODIFIED/REMOVED de este `archive`.

OpenSpec parte el mundo en dos espacios: `openspec/specs/` (fuente de verdad VIVA, comportamiento actual, organizada por dominio) y `openspec/changes/<nombre>/` (paquete del cambio: `proposal.md`, `design.md`, `tasks.md`, delta specs). Al archivar, **los deltas se aplican a `openspec/specs/`** y el paquete se mueve a `changes/archive/` con prefijo de fecha (misma convención que este repo). Sobre los artefactos del paquete la doc es explícita: *"All artifacts remain intact in the archive"* — congelados, NO actualizados.

⇒ En el modelo de referencia, `design.md` (≡ `plan.md`) **se congela a propósito**. Que no reciba deltas NO es un bug. El diagnóstico de los judges de 021 y 022 —y el mío— era incompleto.

El problema real: este repo tomó el vocabulario de deltas de OpenSpec **sin su capa de spec viva**. No hay equivalente de `openspec/specs/`, así que los deltas no tienen dónde aterrizar: archive los mergea de vuelta al mismo `spec.md` que está por congelar, y ahí mueren.

### Q: ¿Sacamos el ítem de plan.md de 023?
Recommended answer: sacarlo y quedar en seis arreglos. Apendear deltas a `plan.md` ALEJARÍA del modelo de referencia. La capa de spec viva es el arreglo de verdad y merece feature propio: es una reestructuración (dónde vive, si se organiza por dominio, qué pasa con los 20+ specs ya archivados), no una tanda de arreglos.
dale saquemos

## Block 4 — Riesgos técnicos

### Decidido por el orquestador (detalle de implementación, no del usuario)
Regla de fences en `extract_section`: alternar estado al ver una línea cuya primera corrida de no-espacios sea ``` o ~~~, trackeado desde el principio del archivo (no desde el heading, para que un fence abierto más arriba cuente); ignorar los `## ` que caigan adentro; un fence sin cerrar deja "adentro" el resto. Principio de desempate: ante la duda, cortar de menos — conservar de más se ve en la salida, cortar de más desaparece en silencio con exit 0, que es el bug. Descartado: un parser Markdown completo; es awk en un script de shell, y la ambición de completitud trajo el `gsub` con clases de caracteres del ciclo 2.

### Q: Hoy `cmd_base_branch` tiene UN solo llamador (el dispatch, o sea la terminal). Cuando `open-pr` lo llame, pasa a tener dos consumidores con expectativas distintas. Devuelve exit 2 si el sidecar apunta a una rama inexistente localmente, y exit 3 si no resuelve nada. Si open-pr propaga eso, un sidecar con una rama borrada bloquea el PR entero. ¿Qué hace open-pr cuando cmd_base_branch falla?
Recommended answer: que NO bloquee — que caiga a la rama por defecto del remoto, lo imprima como `base: main (fallback tras error de resolución)` y lo registre así en `.pr-opened`. Coherente con el Block 1: la herramienta puede adivinar, lo que no puede es callárselo. Un sidecar apuntando a una rama borrada es normal después de mergear una rama intermedia; bloquear el gate ahí castiga el flujo feliz.
ok
