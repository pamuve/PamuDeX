# Tarea 7.1 — Selector de generación condicional

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Mostrar el selector de generación **solo cuando hay diferencias reales** para esa entidad. Si un Pokémon o movimiento nunca ha cambiado, el selector no aparece (evita ruido en la interfaz).

## Contexto extra
Hoy la tabla `relations` tiene una columna `generation` (todo sembrado como 6) y `pokemon`/`moves`/`abilities` tienen su generación de origen, pero **no hay datos históricos de cambios**. Esta tarea crea la infraestructura; el llenado de datos históricos es la tarea 7.3.
Estructura sugerida (añadir a `backend/db/schema.sql`):
`entity_changes(id, entity_type, entity_ref, generation, field, old_value, new_value, note)`.

## Entregable
1. Tabla `entity_changes` + `backend/lib/generations.js` con `hasGenerationalDifferences(entityType, entityRef)` y `getValueAtGeneration(entityType, entityRef, gen)`.
2. Las rutas de ficha (`pokemon/:id`, `moves/:id`, `abilities/:id`, `types/:id`) aceptan `?gen=<n>` y devuelven además `has_generational_differences: boolean`.
3. `frontend/src/components/GenerationSelector.tsx` — se renderiza **solo** si `has_generational_differences` es `true`.
4. Integrarlo en las cuatro páginas de ficha.

## Criterios de aceptación
- [ ] Un Pokémon sin cambios registrados no muestra el selector.
- [ ] Uno con cambios lo muestra y al cambiar de generación se ven los valores de esa generación.
- [ ] Sin `?gen`, la respuesta es la actual (comportamiento de hoy sin cambios).

## Fuera de alcance
La vista "Todas las generaciones" (7.2) y cargar los datos históricos reales (7.3).
