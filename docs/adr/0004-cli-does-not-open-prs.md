# ADR 0004 — La CLI no abre PRs

- **Estado**: aceptada
- **Fecha**: 2026-08-31
- **Revierte parcialmente**: feature 020 (commit per slice + PR gate)
- **Feature que la implementa**: 024

## Contexto

El feature 020 le dio a `bin/sdd` la capacidad de abrir el PR: pre-flight, push, `gh pr create --draft`, y un sidecar `.pr-opened` que distinguía la fase `ready-to-pr` de `archived`. La idea era cerrar el pipeline de punta a punta con un gate humano al final.

Costó 191 líneas de shell repartidas en cinco funciones, más una constante de presupuesto y ~60 referencias en los tests. Y arrastró una dependencia que no se ve a primera vista: para armar el cuerpo del PR hay que extraer secciones de `spec.md`, y de ahí salió `extract_section`.

## Qué pasó

**El cuerpo generado resultó peor que el escrito a mano.** No es una opinión de diseño, es medición sobre dos casos reales:

- Al intentar abrir el PR #207 en otro repo, `sdd open-pr` pusheó y falló al crear el PR: el cuerpo se pasó del límite de 65.536 caracteres de GitHub. El humano lo escribió a mano y salió mejor — del tamaño correcto, con qué se descopea y por qué, los números y los follow-ups.
- Para el PR #19 (feature 023), el cuerpo generado habrían sido **48.757 caracteres**, el 74% del límite, de los cuales 46 KB son `decisions.md` volcado entero: historia de review interna que nadie quiere leer en un PR. El escrito a mano fueron **3.474**.

La causa es estructural, no un bug: un PR se le escribe a una persona que va a revisar el cambio, y lo que esa persona necesita —qué cambia, qué se descopea, qué riesgos quedan— no está en ningún artefacto en una forma que se pueda concatenar. Volcar `decisions.md` es lo más cerca que se puede llegar automáticamente, y es demasiado.

**Y el costo de mantenimiento se concentró en el parser que existía para eso.** `extract_section` acumuló seis defectos vivos a lo largo de tres reescrituras y dos features, incluido un cambio de lenguaje de awk a Node. De sus cuatro call sites, **tres eran para armar el cuerpo del PR**. Se sostuvo un parser de Markdown, y después una dependencia de runtime, para alimentar una salida peor que su alternativa manual.

## Decisión

`bin/sdd` no abre PRs. Se elimina `cmd_open_pr` y toda su maquinaria: `build_pr_body_file`, `build_pr_title`, `append_decisions_capped`, `write_pr_opened_sentinel`, `PR_BODY_MAX_CHARS`, el sidecar `.pr-opened` y la fase `ready-to-pr`.

El gate humano deja de ser código: `/archive-feature`, al terminar, imprime los dos comandos que el humano corre.

Con `open-pr` afuera, `extract_section` queda con un solo consumidor. Las domain rules se mudan a `.claude/rules/domains.md` — un archivo entero en vez de una sección — y el parser se borra junto con la dependencia de Node. `bin/sdd` vuelve a ser shell puro.

## Consecuencias

- `sdd open-pr` desaparece de la superficie pública. Remoción dura: nada de stub, porque un subcomando que "ayuda" deja ambiguo si la feature existe.
- El pipeline termina en `archive`. `sdd-next` no tiene nada que hacer después.
- Nadie registra si el PR se abrió. Lo sabe GitHub y lo sabe el humano; el sidecar era ceremonia que además había que mantener.
- Un `.pr-opened` viejo queda huérfano e inocuo: sin la lógica que lo lee, archivado es archivado.
- Sin código de migración — al decidirse, nadie usaba la versión con `open-pr`.

## Lo que se conserva de 020, y era su valor real

`commit-slice`: un commit por slice, con pathspec acotado, que nunca hace `git add -A`. Eso arregló que `/simplify-code` nunca hubiera funcionado —su scope `<base>..HEAD` estaba siempre vacío bajo la política de no commitear— y sigue siendo la pieza sobre la que se apoya el resto del pipeline. `sdd branch`, `sdd status`, `domain-vocab` y el flujo de archive también quedan enteros.

## Alternativas descartadas

- **Acotar el cuerpo mejor** (recortar `decisions.md` con más criterio, elegir secciones). Fue lo que hizo 022 con `PR_BODY_MAX_CHARS`, y el resultado sigue siendo 74% del límite lleno de historia interna. El problema no es el tamaño, es que el material no existe.
- **Dejar `open-pr` sin armar el cuerpo**, delegando el texto al humano. Deja las 73 líneas de pre-flight y push para ahorrarle al humano dos comandos que ya sabe.
- **Volver `extract_section` a awk** para sacar Node conservando el parser. Recupera portabilidad y reintroduce la clase de defecto que tardó seis en cerrarse.
