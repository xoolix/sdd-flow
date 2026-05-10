---
name: diagnose-bug
summary: Investigación disciplinada de bugs y regresiones de performance.
---

# Purpose
Resolver bugs duros y regresiones siguiendo causa raíz, no síntoma.

# Use when
- Un bug no se resuelve al primer intento.
- Hay incertidumbre sobre la causa raíz.
- Hay regresiones de performance.

# Workflow
1. **Reproducir**: aislar el caso mínimo. Pegar inputs y output observado.
2. **Minimizar**: eliminar variables no relacionadas hasta el reproductor más chico.
3. **Hipotetizar**: listar 2-3 hipótesis explícitas de causa raíz.
4. **Instrumentar**: agregar logs/prints/breakpoints para confirmar o descartar hipótesis. Pegar lo observado.
5. **Fix**: corregir la causa raíz, no el síntoma.
6. **Regression test**: agregar un test que falla sin el fix y pasa con el fix.

# Rules
- No cambiar tests para que pasen sin entender por qué fallaban.
- Si después de 3 intentos la causa no está clara, parar y escalar a `research-spike`.
- Documentar la causa raíz en `decisions.md` de la feature si aplica.
