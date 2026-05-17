# Ingenieria Agentica y Spec-Driven Development
## Por que tus mejores ingenieros ya no escriben codigo (y por que su valor acaba de multiplicarse)

---

## Slide 1 — Agenda

1. La paradoja: Spotify, Amazon, y el estado del arte
2. Fundamentos: modelos, contexto, skills, MCPs
3. Los puntos ciegos de la IA y el envenenamiento de contexto
4. SDD: que es, como funciona, y por que lo necesitamos
5. Pipeline completo: de la idea al archivo
6. Decisiones de diseno y lecciones aprendidas

---

## Slide 2 — La paradoja

![Spotify - TechCrunch](spotify.png)
![Amazon - Financial Times](amazon.png)

> **La paradoja**: Si la IA escribe el codigo, estamos todos despedidos o estamos al borde del colapso de nuestros sistemas? **Ambas realidades coexisten.**

---

## Slide 4 — El espectro de la ingenieria

**Antes de la IA**: dos perfiles coexisten en el espectro.

![El espectro completo](territorio1.png)

```
 > Craft                                          > Execution
 Designs before writing.                           Translates spec to code.
 Models the domain.                                Ticket → Implementation.
 Optimizes for the long term.                      Optimizes for delivery.

 ████████████████████████████████████████████████████████████████████
 ◄── oscuro ─────────────────────────────────────────── claro ──►
```

**Despues de la IA**: la maquina elimina el lado de ejecucion.

![La IA comprime la ejecucion](territorio2.png)

```
 > Craft                                          > Execution
 Designs before writing.                           ̶T̶r̶a̶n̶s̶l̶a̶t̶e̶s̶ ̶s̶p̶e̶c̶ ̶t̶o̶ ̶c̶o̶d̶e̶.̶
 Models the domain.                                ̶T̶i̶c̶k̶e̶t̶ ̶→̶ ̶I̶m̶p̶l̶e̶m̶e̶n̶t̶a̶t̶i̶o̶n̶.̶
 Optimizes for the long term.                      ̶O̶p̶t̶i̶m̶i̶z̶e̶s̶ ̶f̶o̶r̶ ̶d̶e̶l̶i̶v̶e̶r̶y̶.̶

 ████████████████████████████████
 ◄── solo queda el craft ──►
```

> La IA no reemplaza al ingeniero; **elimina a los picacodigo** y comprime el trabajo mecanico. Todo tu tiempo se invierte en **diseno critico**.

---

## Slide 5 — Que es un LLM (en 30 segundos)

- Un modelo de lenguaje predice el **siguiente token** en base a los tokens anteriores
- No "entiende" — calcula la continuacion mas probable dado un contexto
- Generar codigo sintacticamente perfecto **≠** construir un producto de software funcional
- El LLM es el mejor autocompletado del mundo, pero no entiende tu arquitectura completa, ni por que un servicio devuelve un 207 en lugar de un 200, ni las decisiones de hace 6 meses

> **Los LLMs no tienen curiosidad.** No preguntan por limites ni implementan virtualizacion.

---

## Slide 6 — Que es el contexto

```
              ┌─────────────────────────────────┐
              │        El Contexto Humano        │
              │  (Reglas de negocio, deuda       │
              │  tecnica, decisiones historicas)  │
              │    ┌─────────────────────┐       │
              │    │   El Codigo Base    │       │
              │    │  (Abstracciones,    │       │
              │    │  tipos, patrones)   │       │
              │    │  ┌─────────────┐   │       │
              │    │  │ El Prompt   │   │       │
              │    │  │(Instruccion │   │       │
              │    │  │ inmediata)  │   │       │
              │    │  └─────────────┘   │       │
              │    └─────────────────────┘       │
              └─────────────────────────────────┘
```

Contexto no es escribir un prompt muy largo. Es **todo el conocimiento del sistema que vive en la cabeza del ingeniero**. La calidad de este contexto condiciona absolutamente la calidad del output.

> **El modelo no tiene memoria entre sesiones. Todo lo que no esta en el contexto, no existe.**

---

## Slide 7 — La spec sheet de tu nuevo companero

```
 MAXIMIZADAS                              PUNTOS CIEGOS
 ───────────                              ──────────────
 Velocidad de Ejecucion    100%           Juicio de Negocio          0%
   Infinita.                                Nulo.
 Conocimiento Universal    100%           Contexto Historico         0%
   Absoluto (leyo todo SO).                 Arquitectonico. Nulo.
 Resiliencia y Ego         100%           Intuicion sobre            0%
   Reescribira 6 veces                     Edge Cases. Nula.
   sin quejarse.
```

> Un agente escribira con total confianza codigo que es **tecnicamente perfecto, pero contextualmente desastroso** en un repositorio complejo (brownfield).

---

## Slide 8 — Los 3 puntos ciegos de la IA

| | Falta de Contexto de Negocio | Falta de Contexto Tecnico | Incapacidad ante la Deuda |
|---|---|---|---|
| **Caso** | App Sounds conectada a Spotify | Vista de playlist generada por IA | Refactor core a Fluid Functions |
| **Accion de la IA** | Elimina la feature entera en lugar de corregirla | Asume 30 canciones. Colapsa la memoria al recibir 700 | Ignora los side effects a pesar de instrucciones explicitas |
| **Por que fallo** | Estadisticamente correcto para cumplir politicas, pero un desastre a nivel producto | Falta de curiosidad. No pregunto por limites ni implemento virtualizacion | El contexto era demasiado sucio. La IA se pierde y se equivoca con una confianza aterradora |

---

## Slide 9 — Envenenamiento de contexto (Vibe Coding)

```
   Stage 1: Delegar sin revisar
      ↓
   Stage 2: Codigo basura entra a produccion
      ↓
   Stage 3: El codigo basura se convierte en contexto
      ↓
   Stage 4: El siguiente prompt genera basura peor
      ↓
   (loop infinito de degradacion)
```

Imagina pedirle a una IA que añada un lunar a una cara. En 30 iteraciones ciegas, tenes un monstruo irreconocible.

> **El Vibe Coding ciego es Envenenamiento de Contexto a escala industrial.**

---

## Slide 10 — Ingenieria de Contexto: la metrica critica

```
                    Smart Zone ──── Degradation ──── Dumb Zone
                       40%              50%              49%+
```

**3 reglas del contexto:**

| Regla | Descripcion |
|-------|-------------|
| **Regla 1** | Mas contexto no es mejor |
| **Regla 2** | Un historial de chat largo o plugins MCP innecesarios saturan la memoria rapidamente |
| **Regla 3** | Los LLMs son funciones stateless. Su unica realidad son los tokens actuales |

> Tu codigo antiguo es el contexto del proximo prompt. La IA se adaptara a la calidad estructural que encuentre. **GPS del codigo limpio vs Laberinto de la deuda.**

---

## Slide 11 — Compactacion intencional

```
  El Instinto Incorrecto:                 El Movimiento Tactico:
  ───────────────────────                 ─────────────────────
  Discutir con el agente en               Pausar la sesion fallida.
  un chat largo tratando de               Pedir a la IA que extraiga
  corregir un error, alimentando          el estado actual en un archivo
  la zona de tokens inutiles.             Markdown (plan.md).
                                          
                                          → Cerrar sesion
                                          → Abrir nueva sesion limpia
                                          → Inyectar solo el plan.md
                                          → Cero alucinaciones por
                                             contexto arrastrado
```

> La memoria limpia es tu mayor activo.

---

## Slide 12 — Evolucion del control de calidad

```
  1999                2003                2008                2026
  ────                ────                ────                ────
  The Pragmatic       Domain-Driven       Clean Code          Agentes
  Programmer          Design                                  Autonomos
  
  Tracer Bullets      Lenguaje Ubicuo     El codigo es la     ???
  (Prototipado        (La IA necesita     verdad (Los
  rapido y            entender tu         comentarios
  validacion).        dominio para        obsoletos
                      ser util).          confunden
                                          a la IA).
```

> Las tecnicas creadas hace 20 años para evitar que los **humanos** generaran codigo basura (slop) son exactamente las mismas que necesitamos hoy para **controlar a la maquina**.

---

## Slide 13 — La tesis de SDD

```
  Sin SDD                          Con SDD
  ─────────                        ───────
  "haceme X"                       /new-feature → spec.md
       ↓                              ↓
  modelo improvisa                 /plan-feature → plan.md + tasks.md
       ↓                              ↓
  codigo sin spec                  /implement-task → ejecuta 1 tarea
       ↓                              ↓ (repetir por cada tarea)
  no hay review                    /review-feature → 3 agentes votan
       ↓                              ↓
  "ya esta" (?)                    /archive-feature → cierre formal
```

**SDD = el modelo codifica solo lo que esta especificado, y se valida que lo hizo bien.**

> El humano no escribe la sintaxis, el humano gestiona el **flujo de la verdad**.

---

## Slide 14 — Que es un Skill (en nuestro pipeline)

Un skill es un **prompt reutilizable empaquetado como archivo** que se inyecta en el contexto del modelo cuando lo necesitas.

```
.claude/skills/
  new-feature/SKILL.md      ← "como crear un spec"
  plan-feature/SKILL.md     ← "como planificar una feature"
  implement-task/SKILL.md   ← "como implementar una tarea"
  review-feature/SKILL.md   ← "como revisar una feature"
```

- Convierte conocimiento en **comportamiento repetible**
- Sin skills, el modelo improvisa — con skills, ejecuta un proceso definido
- El skill es la **interfaz de orquestacion** entre el humano y el agente

> El objetivo de la fase de spec NO es el codigo. Es forzar a la IA a hacer el **modelado de dominio** y descubrir requerimientos ocultos antes de construir.

---

## Slide 15 — Que es un MCP (Model Context Protocol)

MCP = protocolo estandar para conectar herramientas externas al modelo.

```
Modelo  ←→  MCP Server  ←→  Sistema externo
                              (browser, memoria, APIs, DB)
```

Ejemplos en nuestro stack:
- **Engram** (memoria persistente entre sesiones)
- **Chrome** (automatizacion de browser)
- **Gmail/Calendar/Drive** (integraciones Google)

> Los MCPs extienden lo que el modelo **puede hacer**, los skills controlan **como lo hace**.

---

## Slide 16 — Principios de diseno de SDD

| Principio | Por que |
|-----------|---------|
| **Spec primero** | Si no esta escrito, no se implementa |
| **El humano decide, el modelo ejecuta** | El modelo no toma decisiones de producto |
| **Fases con artefactos** | Cada paso produce un archivo verificable |
| **Validacion automatica** | Lint, tests, y review en cada transicion |
| **Retry con feedback** | Si falla, reintenta con contexto del error (max 2) |
| **Escalation, no loops infinitos** | Si no puede, escala al humano |
| **Sesiones aisladas** | Cada tarea en sesion limpia — prevencion activa de la Dumb Zone |

---

## Slide 17 — El pipeline completo (fase por fase, manual)

![Pipeline SDD + RPI](slides_tab/slide_07.png)

```
                 Quality        Quality         Quality         Quality
                  Gate           Gate            Gate            Gate
                (spec.md)      (plan.md)       (plan.md)       (spec.md)
                   👤              👤               👤              🔴
                   │               │               │               │
 ┌───────────┐     │  ┌─────────┐  │  ┌──────────┐ │  ┌──────────┐ │
 │  Spec &   │─────●─→│Planning │──●─→│Implement │─●─→│ Review   │─●
 │ Research  │        │& Discov.│     │ Aislada  │    │  Loop    │
 └───────────┘        └─────────┘     └──────────┘    └──────────┘
  /new-feature        /plan-feature   /implement-task  /review-feature
  Modelado del        Mapeo del       Ejecucion        Auditoria +
  Dominio             Sistema         Mecanica         Gaps Criticos
                                      (una por una)
```

👤 = Pausa humana: aprobas el artefacto antes de avanzar
🔴 = Review: revision de Gaps Criticos (SPEC-GAP-HIGH)

Cada fase se invoca manualmente con su comando. El humano avanza el pipeline, revisa los artefactos entre fases, y decide cuando continuar.

> **Por que manual primero**: Necesitan entender cada fase y sus artefactos antes de automatizar. La orquestacion autonoma viene despues, cuando el flujo ya esta internalizado.

---

## Slide 18 — Fase 1: Spec & Research

![Fase 1: Spec & Research](slides_tab/slide_08.png)

**Modelo**: Opus (maxima capacidad de razonamiento)

El modelo **no ejecuta, hace preguntas guiadas** para definir:

- Triggers de la funcionalidad
- Happy paths y dominios afectados
- Edge cases (minimo 2)
- Criterios de Aceptacion en **Given/When/Then** (obligatorio)
- Rollback plan y success criteria

**Quality gate**: No genera el spec hasta tener todo. Si falta algo, pregunta.

**Pausa humana**: El desarrollador dicta la arquitectura y aprueba el spec antes de avanzar.

> El objetivo NO es escribir codigo. Es **modelar el dominio** y definir el problema.

---

## Slide 19 — Fase 2: Planning & Discovery

![Fase 2: Planning & Discovery](slides_tab/slide_09.png)

**Modelo orquestador**: Opus | **Sub-agentes**: Sonnet/Haiku

```
  Explorer ──→ ┐
  Explorer ──→ ├──→ Codebase ──→ Evaluador ──→ plan.md
  Explorer ──→ ┘                  (haiku)       tasks.md
```

- Sub-agentes exploradores escanean el repositorio en paralelo
- Un evaluador filtra hallazgos de alto impacto y descarta codigo irrelevante
- Si hay hallazgos significativos → **pausa para el humano** (discovery.md)
- Plan y tareas se generan en paralelo

**El concepto clave: Alineacion Mental.** El humano lee el plan, no 1,000 lineas de codigo. Esto asegura que todo el equipo entiende como va a cambiar el sistema antes de que el codigo exista.

---

## Slide 20 — Fase 3: Implementacion Aislada

![Fase 3: Implementacion Aislada](slides_tab/slide_10.png)

**Modelo**: Sonnet (balance costo/capacidad)

```
plan.md → Implementa 1 tarea → Validacion Inline → Pass? → Codigo + Tarea [x]
                                 (Lint, Tests)        │
                                      ↑               │ Fail
                                      └── Correccion ←┘
                                      Autonoma (Max 3)
```

- Se lanza una **sesion completamente nueva** por tarea
- Contexto limitado estrictamente a la tarea actual
- Prevencion activa de la **Dumb Zone**
- Si diverge del spec, documenta el delta en `decisions.md`

> El modelo no decide que hacer — ejecuta lo que el plan dice.

---

## Slide 21 — Fase 4: The Review Loop & Adversarial Gaps

![Fase 4: Review Loop & Adversarial Gaps](slides_tab/slide_11.png)

**Modelo**: Sonnet (x3 en paralelo + 1 adversarial)

### Conformance Voting
- 3 agentes independientes evaluan el codigo contra los criterios Given/When/Then
- Un solo voto de fallo rechaza la implementacion (conservador)
- Ejecutan tests reales, no analisis estatico

### Adversarial Agent
- Un cuarto agente **ataca las premisas, no el codigo**
- Busca edge cases olvidados
- Detecta asunciones no documentadas
- Encuentra brechas de seguridad funcionales

**Pausa Humana**: Revision exclusiva de **Gaps Criticos (SPEC-GAP-HIGH)**. El codigo no se integra a ciegas.

---

## Slide 22 — Voting y escalation

| Escenario | Resultado |
|-----------|-----------|
| 3 iguales | Usa ese veredicto |
| 2 PASS + 1 WARN | Mayoria (PASS) con nota |
| 2 PASS + 1 FAIL | **FAIL** (conservador) — escala al humano |
| 2+ FAIL | FAIL — merge de criterios fallidos |
| 3 distintos | **FAIL** — escala al humano |

> Filosofia: ante la duda, FAIL. Es mas barato re-revisar que deployar un bug.

---

## Slide 23 — Engram: la memoria transversal

![Engram: La Memoria Transversal](slides_tab/slide_12.png)

```
 Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
   │            │            │            │
   ↓            ↓            ↓            ↓
 mem_save     mem_save     mem_save     mem_search
 (decisions)  (decisions)  (decisions)  (recuperacion)
   │            │            │            │
   └────────────┴────────────┴────────────┘
                      ↓
              Base de Datos Engram
```

**El problema**: Al crear sesiones nuevas constantemente para proteger el contexto, el LLM sufre de amnesia.

**La solucion**: Engram actua como el hipocampo del sistema. Registra decisiones de negocio y deltas arquitectonicos. Garantiza que una feature pausada hoy y retomada en un mes mantenga el 100% de su contexto historico.

---

## Slide 24 — Model Routing estrategico

| Fase / Tarea | Modelo | Por que |
|---|---|---|
| Orchestrator & Spec | **Opus** | Maxima capacidad de razonamiento complejo, coordinacion de logica abstracta y modelado de negocio |
| Explore, Design, Implement, Review | **Sonnet** | El balance perfecto entre velocidad, costo y calidad de ejecucion para escritura de sintaxis repetitiva |
| Discovery Evaluator & Archive | **Haiku** | Filtrado de hallazgos masivos a alta velocidad y tareas mecanicas de cierre con un costo infimo de tokens |

> **No todo necesita el modelo mas caro.** Optimizar el modelo por tarea = menos costo, misma calidad, mas velocidad.

---

## Slide 25 — Resiliencia: que pasa cuando algo falla

| Problema | Solucion SDD |
|----------|-------------|
| Tests fallan despues de implementar | El agente intenta fix inline antes de marcar [x] |
| Review falla | El review te da feedback estructurado → vos relanzas `/implement-task` con las correcciones → re-review |
| El agente no puede resolver solo | Vos lees el diagnostico, decidis como seguir, y relanzas la fase |
| Contexto se compacta a mitad de tarea | Todo esta en archivos (spec, plan, tasks, decisions) — abris sesion nueva y seguis |
| Feature scope cambia durante exploracion | El discovery checkpoint te avisa — vos decidis si ajustar el spec |
| Spec tiene gaps no detectados | El adversarial agent los encuentra post-review — vos decidis que hacer |

---

## Slide 26 — La Matriz de Transformacion

| | El Viejo Mundo (2020) | La Nueva Realidad (2026) |
|---|---|---|
| **Velocidad** | Lineas de codigo tecleadas por dia | Ciclos de iteracion y validacion evaluados por dia |
| **Core Skill** | Memorizacion de sintaxis y librerias | Modelado de dominio y diseño de sistemas |
| **Calidad del Codigo** | Un ejercicio estetico para el equipo | **Contexto critico de supervivencia** para que la IA no colapse el sistema |
| **Tu Rol** | Constructor mecanico | **Orquestador y curador de contexto** |

---

## Slide 27 — El nuevo perfil del ingeniero

```
  El Picateclas                           The Craft /
  (Mecanico)                              Arquitecto de Dominio
  ┌──────────┐                            ┌──────────────────┐
  │ ⌨️⌨️⌨️⌨️  │                            │  📐 Compas +     │
  │ keyboard │                            │  Plano tecnico   │
  └──────────┘                            └──────────────────┘
```

- La IA comprimio el trabajo mecanico. No competimos en sintaxis ni en velocidad.
- El nucleo de la ingenieria es ahora el **Domain Driven Design (DDD)**, el modelado a largo plazo y las abstracciones limpias.
- Tu codigo se convierte en un **mapa de GPS para la IA**. Escribir buen software es ahora mas indispensable que nunca.

---

## Slide 28 — Evolucion: como llegamos hasta aca

```
v0  "Che modelo, haceme esta feature"
     → Output inconsistente, sin validacion, sin trazabilidad

v1  Skills + Engram + model routing + discovery + adversarial review
     → Proceso definido — el humano invoca cada fase manualmente
     → Memoria persistente entre sesiones (Engram)
     → El pipeline ya se auto-cuestiona (discovery, adversarial)
     → USTEDES ESTAN ACA ← ← ←

v2  Orquestador autonomo (sdd-next, sdd-auto)
     → Validacion automatica, retry con feedback, escalation
     → El humano solo interviene en decisiones reales
     → (cuando ya dominen el flujo manual)
```

---

## Slide 29 — Reglas de Oro de la Era Agentica

| | Regla |
|---|---|
| **1. Protege tu Contexto** | Ante el primer bucle de alucinacion, cierra la sesion. La memoria limpia es tu mayor activo. |
| **2. El Codigo es Contexto** | Codigo basura hoy equivale a codigo de IA basura mañana. Manten abstracciones pristinas. |
| **3. Planea y Comprime** | La actividad de mayor apalancamiento es diseñar un `plan.md` impecable, no escribir funciones. |
| **4. No Subcontrates el Pensamiento** | La IA tiene velocidad infinita, pero curiosidad cero. El humano es el unico arbitro de la verdad del negocio. |

---

## Slide 30 — Cierre

> **La parte mecanica ha muerto. La ingenieria nunca ha sido tan importante.**

No te obsesiones con generar lineas de codigo. Entiende el problema, modela el dominio y haz las preguntas que la maquina ni siquiera sabe que ignora.

Ese es el verdadero arte de programar en 2026.

---

## Slide 31 — Preguntas

```
specs/
  NNN-feature-name/
    spec.md          ← que construir
    plan.md          ← como construirlo
    tasks.md         ← en que orden
    decisions.md     ← que cambio y por que
    discovery.md     ← que encontramos (si aplica)
```

Todo queda en git. Todo es auditable. Todo es reproducible.
