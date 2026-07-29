# Tarea 6.1 — Base de reglas de Pokémon Champions

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Modo independiente con su propia base de datos de contenido permitido: qué Pokémon, objetos, movimientos y habilidades son legales, más reglas propias.

## Contexto extra
La tabla `champions_rules` YA existe en `backend/db/schema.sql`:
`id, name, allowed_pokemon_json, allowed_items_json, allowed_moves_json, allowed_abilities_json, custom_multipliers_json`.
Champions **no** es una sesión de ROM Hack (Fase 3): es un modo aparte, con su propia base y sus propias reglas. Mantén los dos sistemas separados aunque compartan el catálogo base.

## Entregable
1. `backend/routes/champions.js` — CRUD de conjuntos de reglas + `GET /api/champions/:id/pokemon`, `/moves`, `/abilities`, `/items` devolviendo solo lo permitido.
2. `backend/lib/championsFilter.js` — filtra cualquier listado del catálogo global según un conjunto de reglas.
3. `frontend/src/lib/api.ts` — bloque `champions`.
4. `frontend/src/pages/ChampionsRules.tsx` en `/champions/reglas` — crear conjuntos de reglas y marcar/desmarcar contenido permitido con casillas y filtro de búsqueda (debe ser cómodo marcar decenas de entradas).

## Criterios de aceptación
- [ ] Con un conjunto de reglas que solo permite 10 Pokémon, `GET /api/champions/:id/pokemon` devuelve exactamente esos 10.
- [ ] Las reglas persisten en SQLite y sobreviven a reiniciar el contenedor.
- [ ] No afecta en nada al modo estándar ni a las sesiones.

## Fuera de alcance
El multiplicador propio (6.2) y la vista de consulta filtrada (6.3).
