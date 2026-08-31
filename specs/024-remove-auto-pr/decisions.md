# Decisions

[2026-08-31] DISCOVERY: dos hallazgos altos, ambos sobre el alcance no definido del barrido de AC5. Resueltos con una sola regla — barre `bin/`, `src/`, `.claude/**`, `.specify/templates/**`, `tests/**`; excluye `docs/` y `specs/`. Principio: se protege contra instrucciones y llamadas colgadas, no contra menciones históricas. Ver `discovery.md` para las once decisiones.
[2026-08-31] spec.md quedó en 690 palabras contra 650. Se registra en vez de recortar: lo que excede es el razonamiento del alcance de AC5 ("protege contra instrucción colgada, no contra mención histórica"), que es justamente lo que evita que el reviewer vuelva a derivar la contradicción que bloqueó el discovery. Sexto artefacto consecutivo por encima del presupuesto en esta familia de specs.
[2026-08-31T17:18:47Z] implemented-by: claude
