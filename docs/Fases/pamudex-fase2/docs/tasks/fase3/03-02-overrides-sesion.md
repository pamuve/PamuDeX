# Tarea 3.2 — Mecanismo de overrides por sesión

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Que una sesión pueda **sobrescribir** tipos, Pokémon, movimientos, habilidades y relaciones de tipo sin tocar los datos globales. Es la base de todo el soporte de ROM Hacks.

## Contexto extra
Depende de la tarea 3.1 (`backend/routes/sessions.js` y la sesión activa en `localStorage`).
El campo `sessions.data_json` almacena los overrides con esta forma:

```json
{
  "types": { "fuego": { "name_es": "Llama", "color": "#FF5500" } },
  "pokemon": { "25": { "stats": { "spe": 120 }, "types": ["electrico","hada"] } },
  "moves": { "6": { "power": 110 } },
  "abilities": { "3": { "effect_es": "..." } },
  "relations": { "fuego": { "agua": 1 } }
}
```
Regla: si una clave no aparece en el override, se usa el valor global. Un merge superficial por entidad es suficiente.

## Entregable
1. `backend/lib/overrides.js` — `applyOverrides(baseEntity, override)` y `getSessionOverrides(db, sessionId)`.
2. Todas las rutas existentes (`types`, `pokemon`, `moves`, `abilities`, `search`) aceptan `?session=<id>` opcional y aplican los overrides antes de responder. **Sin `?session` el comportamiento actual no cambia.**
3. Importante: si el override toca `relations`, hay que recalcular la efectividad (`backend/lib/effectiveness.js` usa la tabla `relations`) — adapta `effectiveness.js` para aceptar una tabla de relaciones inyectada en vez de leer siempre de la DB.
4. `frontend/src/lib/api.ts` — añadir el parámetro `session` a todas las llamadas, tomándolo de `pamudex_active_session`.

## Criterios de aceptación
- [ ] Con una sesión que cambia Pikachu a Eléctrico/Hada, `GET /api/pokemon/25?session=1` devuelve los dos tipos y una `efectividad` recalculada acorde.
- [ ] Sin `?session`, la respuesta es idéntica a la de antes de esta tarea.
- [ ] Un override de `relations` cambia realmente los multiplicadores devueltos.

## Fuera de alcance
La UI para editar esos overrides (tareas 3.3 y 3.4). Aquí solo el motor + endpoints.
