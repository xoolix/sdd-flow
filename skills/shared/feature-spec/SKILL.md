---
name: feature-spec
summary: Entrevistar adversarialmente al usuario para producir clarify.md y spec.md de una feature.
---

# Purpose
Convertir una idea o pedido en `clarify.md` (Q&A crudas) y `spec.md` (formal) a través de un interrogatorio profundo que cubre todas las ramas del árbol de decisión.

# Use when
- Empieza una feature nueva.
- Una feature existente necesita acceptance criteria o requirements antes de planear.
- Hay ambigüedad en scope, supuestos o decisiones técnicas.

# Inputs
- Idea inicial del usuario.
- `architecture-map` y `repo-conventions` skills.
- ADRs existentes en `docs/adr/`.

# Workflow
1. Identificar feature ID. Crear folder `specs/<feature-id>/` (con `create-feature.sh` si está disponible) e inicializar `clarify.md` y `decisions.md`.
2. Conducir la entrevista en bloques pequeños (1-3 preguntas relacionadas por turno). Esperar respuesta antes de seguir. **No** mandar el cuestionario entero de una.
3. Cubrir las siguientes categorías **en orden**, sin avanzar a la próxima sin cerrar la actual:

   **Problema**
   - ¿Qué problema concreto resuelve? ¿Síntoma o causa raíz?
   - ¿Qué pasa hoy si no hacemos esto? ¿Qué cambia mañana cuando esté?
   - ¿Por qué ahora?

   **Usuarios y stakeholders**
   - ¿Quién lo usa? ¿En qué momento del flujo?
   - ¿Frecuencia de uso? ¿Volumen?
   - ¿Hay roles distintos con expectativas distintas?

   **Scope**
   - ¿Qué está adentro? Para cada cosa, preguntar por qué.
   - ¿Qué está afuera? Para cada cosa, preguntar por qué afuera y no adentro.
   - ¿Hay algo que el usuario podría esperar que NO vamos a hacer? Listarlo explícito.

   **Supuestos**
   - ¿Qué se asume sobre datos, performance, escala, infra, costos?
   - Si una respuesta es vaga ("rápido", "muchos"), repreguntar para obtener números o referencias concretas.
   - Listar supuestos explícito.

   **Edge cases y modos de falla**
   - ¿Qué pasa con inputs vacíos, malformados, extremos?
   - ¿Qué pasa si el sistema upstream falla? ¿Si la base está caída? ¿Si el modelo se cuelga?
   - ¿Cómo se detecta cuando algo sale mal?
   - ¿Hay degradación elegante o falla dura?

   **Alineación de dominio**
   - ¿Cómo se relaciona con conceptos existentes del codebase?
   - ¿Hay conflictos de naming con código actual?
   - ¿Conviene crear un término nuevo o reusar uno existente?

   **Decisiones duras**
   - Identificar 2-5 decisiones técnicas con tradeoffs reales (no triviales).
   - Para cada una: pedir la elección, el porqué, y la alternativa rechazada.
   - Para cada decisión arquitectural persistente, ofrecer crear un ADR en `docs/adr/` en el momento. Si el usuario confirma, crear el archivo en el mismo paso.

   **Acceptance criteria**
   - ¿Cómo sabemos que está listo? Criterios verificables.
   - ¿Cómo se testea cada criterio?

4. Mientras conversa, ir actualizando `clarify.md` incrementalmente con las respuestas **literales** del usuario. No parafrasear las decisiones del usuario; pegar lo que dijo.
5. Cerradas las 8 categorías, el agente **redacta solo** los bloques que requieren formato (acceptance en Given/When/Then, rollback plan, success metric medible) y los presenta al usuario para validación. El usuario confirma o corrige; el agente no avanza hasta que cada bloque esté validado.
6. Formalizar el contenido de clarify.md + bloques validados en `spec.md` siguiendo `.specify/templates/spec-template.md`. spec.md es **transformación**, no contenido nuevo.
7. Cerrar listando: open questions que quedaron, ADRs creados, y recomendación sobre si abrir `/research-spike` cuando hay incertidumbre técnica que no se resolvió en la entrevista.

# Rules
- NO asumir respuestas. Si una respuesta es vaga, repreguntar con un caso concreto.
- NO avanzar a la próxima categoría sin cerrar la actual.
- NO inventar contenido en spec.md que no esté en clarify.md o en los bloques validados.
- Pegar respuestas literales del usuario en clarify.md, no parafrasear sus decisiones.
- GWT, rollback y success metric los redacta el agente y los valida el usuario — no se le pide al usuario que los escriba en formato estructurado.
- Si una decisión es claramente arquitectural y persistente, ofrecer crear ADR en el momento, no postponer.
- Si una pregunta destapa que falta research técnico real, recomendar parar y abrir research-spike antes de seguir.

# Output
- `specs/<feature-id>/clarify.md` con secciones por categoría y Q&A crudas.
- `specs/<feature-id>/spec.md` formalizado siguiendo el template estándar.
- Cero, uno, o más ADRs en `docs/adr/`.
- Lista de open questions y recomendaciones al final de la sesión.
