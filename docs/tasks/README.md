# Encargos para IA

Cada archivo es una tarea del tamaño de **una sola conversación**, pensada para no agotar los límites de un plan gratuito.

## Cómo usarlo

1. Abre una conversación nueva con la IA (Claude, ChatGPT, Gemini, la que sea).
2. Pega el contenido de **`_CONTEXTO_BASE.md`**.
3. Pega el contenido del **archivo de la tarea** que toque.
4. Adjunta los archivos fuente concretos que la tarea mencione, si los pide.
5. Copia el código generado a tu repositorio y haz commit.

Con esos dos archivos, la IA no necesita saber nada más del proyecto.

## Índice

| Fase | Tareas | Estado |
|------|--------|--------|
| 2 — Comparador de equipos | `fase2/` (5) | ✅ Implementada |
| 3 — Sesiones + editor visual | `fase3/` (5) | ✅ Implementada |
| 4 — Import / export | `fase4/` (4) | ✅ Implementada |
| 5 — Usuarios y perfiles | `fase5/` (4) | ✅ Implementada |
| 6 — Pokémon Champions | `fase6/` (3 + preparación) | 🔜 **la siguiente** — lee antes `fase6/00-preparacion.md` |
| 7 — Multi-generación | `fase7/` (3) | 🔜 |
| 8 — Accesibilidad y rendimiento | `fase8/` (4) | 🔜 |
| 9 — Ampliaciones | `fase9/` (5) | 🔜 |

Las tareas de una fase están ordenadas por dependencia: haz la `-01` antes que la `-02`. Entre fases distintas hay más libertad, salvo que la propia tarea diga de qué depende.

Un archivo `00-preparacion.md` dentro de una fase **no es una tarea**: es la nota previa que recoge lo que hay que decidir antes de encargar la primera, porque los encargos se redactaron todos de golpe al principio del proyecto y el repo ha avanzado desde entonces. Hoy solo la Fase 6 tiene una.

Los archivos de `fase2/` y `fase3/` se conservan aunque ya estén implementadas: sirven de referencia del estilo y para rehacer alguna pieza si hiciera falta. En `docs/Fases/` está además el entregable original de cada fase, tal cual se recibió, para poder comparar contra el repo.

Para crear tareas nuevas que no estén en el roadmap, usa `docs/AI_TASK_TEMPLATE.md`.
