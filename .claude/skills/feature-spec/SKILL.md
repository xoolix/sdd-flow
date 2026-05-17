---
name: feature-spec
description: "Reference doc for the grill-style technical interview methodology that produces clarify.md + spec.md (+ ADRs). The canonical executor is the /new-feature command — this file documents the workflow."
disable-model-invocation: true
---

# Purpose
Convertir una idea o pedido en `clarify.md` (Q&A crudas) y `spec.md` (formal) a través de una entrevista técnica: una pregunta por turno, con recomendación concreta y anclada en código real.

> **Note**: este SKILL.md es la referencia metodológica. El ejecutor real es `/new-feature`, que corre inline porque necesita diálogo multi-turn con el usuario.

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
2. Hacer un mini-scan silencioso del codebase: archivos, símbolos, rutas, tests o contratos que puedan responder preguntas sin molestar al usuario.
3. Conducir la entrevista en 5 bloques, **una pregunta por turno**. Cada pregunta incluye `Recomendación: <opción concreta + razón>`. Si el código responde la duda, no preguntarla.

   **Comportamiento**
   - Qué cambia para el usuario/sistema y qué variantes existen.

   **Scope técnico**
   - Archivos, módulos, tipos, rutas o servicios tocados. Qué se reutiliza vs qué se crea.

   **Contrato / datos**
   - API/evento/schema/request/response. Compatibilidad y shape esperado.

   **Riesgos técnicos**
   - Upstream, estados intermedios, edge cases, degradación o falla dura.

   **Acceptance + rollback**
   - Cómo se verifica, qué test prueba el cambio, cómo se revierte o desactiva.

4. Mientras conversa, ir actualizando `clarify.md` incrementalmente con las respuestas **literales** del usuario y la recomendación propuesta. No parafrasear las decisiones del usuario; pegar lo que dijo.
5. Cerrados los 5 bloques, el agente **redacta solo** los bloques que requieren formato (acceptance en Given/When/Then, rollback plan, success metric medible) y los presenta al usuario para validación. El usuario confirma o corrige; el agente no avanza hasta que cada bloque esté validado.
6. Formalizar el contenido de clarify.md + bloques validados en `spec.md` siguiendo `.specify/templates/spec-template.md`. spec.md es **transformación**, no contenido nuevo.
7. Cerrar listando: open questions que quedaron, ADRs creados, y recomendación sobre si abrir `/research-spike` cuando hay incertidumbre técnica que no se resolvió en la entrevista.

# Rules
- NO asumir respuestas. Si una respuesta es vaga, repreguntar con un caso concreto.
- Preguntar de a una. No mandar baterías de preguntas.
- Toda pregunta lleva recomendación concreta.
- NO avanzar al próximo bloque sin cerrar el actual.
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
