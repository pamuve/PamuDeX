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
- [x] Con un conjunto de reglas que solo permite 10 Pokémon, `GET /api/champions/:id/pokemon` devuelve exactamente esos 10.
- [x] Las reglas persisten en SQLite y sobreviven a reiniciar el contenedor.
- [x] No afecta en nada al modo estándar ni a las sesiones.

## Fuera de alcance
El multiplicador propio (6.2) y la vista de consulta filtrada (6.3).

## Decisión que tomó esta tarea: `null` no es `[]`

El encargo no lo decía y hay que elegirlo antes de escribir la primera línea:

| valor de la columna | significado |
|---|---|
| `NULL` | **sin restricción**: vale todo el catálogo |
| `[]` | **nada permitido** de esa entidad |
| `[1,4,7]` | solo esos |

Con la otra lectura («vacío = nada permitido»), crear un conjunto dejaría el
modo sin un solo Pokémon y habría que marcar 1025 casillas antes de poder
consultar nada. Además cada entidad se restringe por su cuenta: un formato que
solo limita objetos no tiene que decir nada de los movimientos.

## Notas de implementación

- El `PUT` es **parcial** y valida todo antes de escribir: un cuerpo inválido no
  deja el conjunto a medias. `custom_multipliers_json` se conserva pero no se
  edita (es de la 6.2).
- `champions_rules` **no tiene `profile_id`** y se deja así: los conjuntos son
  del hogar. Cuál está activo será de cada perfil, en `settings` (6.3).
- La pantalla **no guarda casilla a casilla**: sería una petición por clic y
  dejaría estados a medias si se corta la red. Se edita un borrador local con
  aviso de cambios sin guardar.
- **Solo se pintan 200 filas** (hay 2151 objetos y no hay virtualización en el
  proyecto). El buscador y los botones de marcar en bloque operan sobre **todo
  lo filtrado**, no solo sobre lo visible: buscar `held-items` y pulsar «marcar
  los 78 filtrados» es lo que hace cómodo montar un formato.
- El editor lee el catálogo **global** (`catalogApi`, con `session: false`),
  porque Champions y las sesiones de ROM Hack son modos excluyentes.
- Entrar en el modo sigue sin existir: el menú «Modo» de la `TopBar` solo enlaza
  el editor de reglas hasta que llegue la 6.3.
