# Discovery Report
status: findings-present

Tres hallazgos high. Escribí tu decisión bajo `## User decisions` como
`DISCOVERY-ACCEPTED: <F#> — <decisión>` o `DISCOVERY-DISCARDED: <F#> — <razón>`,
y re-corré `/plan-feature 022-pipeline-integrity-fixes`.

## High-impact findings

- **[edge-case] F2 — `--moved-from` puede hacer lo contrario de lo pedido, en silencio.** El spec
  dice que un path que nunca estuvo trackeado debe salir distinto de cero y nombrarse, "never a
  silent no-op". Probado en repo temporal, hay cuatro formas y una rompe eso: path **nunca trackeado
  pero todavía presente en disco** → `git add` sale 0 y lo stagea como **archivo nuevo**. No es un
  no-op silencioso, es una operación equivocada silenciosa, y ningún chequeo de exit code la agarra.
  (Las otras tres se portan bien: trackeado-y-borrado stagea el borrado; nunca-trackeado-y-ausente
  sale 128 con `fatal: pathspec`, que el patrón `if ! git add` ya convierte en fallo controlado.)
  **Decisión requerida**: ¿se agrega el guard `git ls-files --error-unmatch -- "$path"` antes del
  `git add`? Probado: devuelve 0 para trackeado-y-borrado y 1 para las dos formas sin trackear,
  incluyendo directorios.
  _Recomendación_: sí. Es tres líneas y es la única forma de cumplir lo que el spec ya promete.
  [impact: high]

- **[simplification] F3 — "fase no reintentable" es un mecanismo nuevo, no una redacción.** El §F
  aplica su lógica de reintentos sin condición: toda fase que falla validación se relanza hasta dos
  veces y después ESCALATED. No hay flag, lista ni rama para "esta fase ya mutó estado, no la
  reintentes". El grep exhaustivo por `idempoten|non-retry|retryable|irreversible` no encontró
  precedente a nivel orquestador; lo más cercano es la tabla skip/no-retry de `sdd-cross-reviewer`,
  que es manejo interno de un subproceso y cuya línea 88 dice explícitamente que es "separate from
  review-feature's orchestrator-level retries".
  **Decisión requerida**: ¿cómo se marca una fase como no reintentable — una lista explícita en §F,
  un campo en el frontmatter del agente, o hardcodear archive como caso único?
  _Recomendación_: lista explícita en §F. Es el archivo que ya define el protocolo de reintentos,
  queda en un solo lugar conceptual, y admite un segundo caso el día que aparezca sin rediseñar nada.
  Hardcodear archive resuelve hoy y obliga a rediseñar mañana.
  [impact: high]

- **[edge-case] F12 — el sexto arreglo entró por delta y no tiene criterio de aceptación.** El spec se
  escribió con cinco arreglos y seis AC. La detección de specs sin archivar se agregó después
  (`Delta: 2026-08-26`), y no hay AC que la cubra. Además no tiene superficie donde vivir: `sdd status`
  sin feature-id lo deriva de la rama y falla con `not on a feature branch`; no hay modo "listar
  todo". `sdd doctor` chequea presencia de skills y archivos, no fases de features.
  **Decisión requerida**: ¿se agrega un séptimo AC para el sexto arreglo, o se saca de 022 y va aparte?
  _Recomendación_: agregar el AC. El arreglo es chico (`sdd status` sin argumentos lista las carpetas
  de `specs/` con su fase) y el principio que lo motiva —que un spec viejo es contexto falso que el
  modelo lee como trabajo activo— es exactamente lo que 022 dice defender. Un arreglo sin AC es un
  arreglo que nadie verifica.
  [impact: high]

## Other findings

- [edge-case] F1 — `extract_section` devuelve un comentario HTML como contenido. Verificado corriendo la función real: `§ Domain rules` sin sus bullets sigue devolviendo `<!-- Project-specific business logic rules -->` (46 chars, no vacío). Una sección realmente en blanco y un heading ausente sí dan vacío. O sea que `domain-vocab` no puede implementar "vacío" como `[ -z "$(extract_section ...)" ]` — necesita filtrar líneas de comentario y en blanco antes. Es el estado exacto en que `conventions.md` sale en cualquier proyecto que no la llenó. [impact: medium]
- [simplification] F4 — la frase a cambiar está duplicada en cinco lugares: `sdd-phase-common.md:104`, `sdd-next/SKILL.md:177` y `sdd-auto/SKILL.md:120` para el "skip if phase produces no code"; más `sdd-next/SKILL.md:196-197` y `sdd-auto/SKILL.md:125` para la lógica de reintentos. Ninguno nombra qué fases producen código — "spec or plan" es solo un ejemplo. [impact: medium]
- [conflict] F5 — los cuatro consumidores (`sdd-designer.md`, `sdd-research-spike.md`, `new-feature/SKILL.md`, `plan-feature/SKILL.md`) cierran con "the agent reads the rules file directly, **the CLI never does**". Con `domain-vocab` eso pasa a ser falso. Hay que reescribirlo en los cuatro. [impact: medium]
- [edge-case] F6 — reordenar el Step 3 obliga a mantener cuatro referencias a números de step en sincronía (`plan-feature/SKILL.md:37`, `:94`, `:96`, y `sdd-designer.md:29`), y una ya está mal: `sdd-designer.md:29` dice "from the orchestrator's step 2 analysis" cuando el domain analysis es Step 3. Drift preexistente. [impact: medium]
- [edge-case] F8 — `plan-template.md` no tiene sección donde aterrice el domain analysis. Step 3 dice "document it at the top of the plan" y el designer lo lista como fill item, pero las secciones del template son otras. Hoy cae como prosa suelta arriba de todo. Preexistente. [impact: medium]
- [reuse] F7 — el sizing es seguro de reordenar: los umbrales SMALL/MEDIUM/LARGE son aritmética de conteo de dominios (1-2 / 2-4 / 4+), sin acoplamiento a las palabras literales. Step 4 itera lo que Step 3 haya producido y `sdd-explore-agent` es agnóstico a la taxonomía. [impact: low]
- [reuse] F9 — en el discovery-resume path la única fuente siempre presente es el spec. La salida cruda de los Explore nunca se persiste; solo sobrevive el `discovery.md` curado, y solo si hubo hallazgos high. Confirma que la redacción del Happy Path apunta a la fuente correcta. [impact: low]
- [simplification] F10 — las dos formas de fallo de `domain-vocab` deben colapsar a un solo exit code. El spec ya escribe "empty or absent" como una sola rama y ningún consumidor las distingue. El esquema graduado en uso es `2`=usage, `3`=irresoluble, `4`=fallo de git, `5`=nada stageado; `3` es el que calza. [impact: low]
- [reuse] F11 — no existe resolución de raíz del repo en `bin/sdd`: todos los comandos arman paths desde `$(pwd)`. `domain-vocab` debe seguir esa convención en vez de inventar la primera. [impact: low]

## User decisions

- **DISCOVERY-ACCEPTED: F2** — `--moved-from` guarda con `git ls-files --error-unmatch -- "$path"`
  antes del `git add`. Probado: devuelve 0 para trackeado-y-borrado (el caso que queremos) y 1 para
  las dos formas sin trackear, incluyendo directorios. Es lo único que cumple la promesa del spec de
  que un path nunca trackeado sale distinto de cero y se nombra, en vez de stagearse como archivo nuevo.

- **DISCOVERY-ACCEPTED: F3** — las fases no reintentables se declaran en una **lista explícita en §F**
  de `sdd-phase-common.md`, junto a la lógica de reintentos que ya vive ahí. Se descartó hardcodear
  archive (resuelve hoy, obliga a rediseñar cuando aparezca el segundo caso) y se descartó un campo en
  el frontmatter del agente (la decisión es del orquestador, no del agente). El carve-out debe
  replicarse en los dos orquestadores, que reafirman los reintentos por su cuenta.

- **DISCOVERY-ACCEPTED: F12** — se agrega un séptimo criterio de aceptación para la detección de
  specs sin archivar. Un arreglo sin AC es un arreglo que nadie verifica. La superficie es
  `sdd status` sin feature-id listando las carpetas de `specs/` con su fase.
