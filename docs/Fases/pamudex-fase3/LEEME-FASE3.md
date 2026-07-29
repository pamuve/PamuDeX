# PamuDeX — Fase 3 completa

Sesiones personalizadas + editor visual. Cubre las cinco tareas del roadmap.

| # | Tarea | Dónde está |
|---|---|---|
| 3.1 | CRUD de sesiones | `backend/routes/sessions.js`, `frontend/src/pages/Sessions.tsx`, `frontend/src/lib/session.ts` |
| 3.2 | Overrides por sesión | `backend/lib/overrides.js`, `backend/lib/typechart.js`, `backend/middleware/sessionOverrides.js`, `backend/routes/chart.js`, `frontend/src/lib/apiSession.ts` |
| 3.3 | Editor de Pokémon | `frontend/src/components/forms/PokemonForm.tsx`, `frontend/src/pages/EditorPokemon.tsx` |
| 3.4 | Editores de tipos, movimientos, habilidades y relaciones | `frontend/src/components/forms/{TypeForm,MoveForm,AbilityForm,RelationsMatrix}.tsx`, `frontend/src/pages/Editor.tsx`, `frontend/src/hooks/useSessionOverride.ts` |
| 3.5 | Tema por sesión | `frontend/src/lib/theme.ts`, `frontend/src/components/forms/ThemeForm.tsx`, `frontend/src/theme-vars.css`, `_integracion/tailwind.config.js` |

**Empieza por [`_integracion/README-INTEGRACION.md`](_integracion/README-INTEGRACION.md).**

---

## Una decisión de diseño que conviene conocer

El encargo original de la tarea 3.2 pedía modificar `routes/types.js`,
`pokemon.js`, `moves.js`, `abilities.js`, `search.js` y `lib/effectiveness.js`
uno a uno para que aceptasen `?session=`.

Aquí se ha hecho con un **middleware** (`backend/middleware/sessionOverrides.js`)
que intercepta `res.json` justo antes de responder y aplica los overrides sobre
el resultado. El efecto es el mismo y ninguna ruta de la Fase 1 se toca.

Ventajas:

- Cero riesgo de romper código que ya funciona.
- Sin `?session=` en la query el middleware hace `next()` y se aparta: la API
  se comporta exactamente igual que antes.
- Un solo sitio que auditar cuando algo no cuadre.

El precio: el middleware tiene que deducir el formato de las respuestas en vez
de conocerlo. Por eso reconstruye los grupos de efectividad copiando etiquetas,
claves y orden de la respuesta original, y ante cualquier imprevisto devuelve
el dato global sin transformar.

---

## Rutas nuevas

Frontend: `/sesiones`, `/editor`, `/editor/pokemon`.

Backend:

```
GET    /api/sessions
POST   /api/sessions
GET    /api/sessions/:id
PUT    /api/sessions/:id
POST   /api/sessions/:id/duplicate
DELETE /api/sessions/:id
GET    /api/chart[?session=<id>]

+ ?session=<id> opcional en /api/types, /api/pokemon, /api/moves,
  /api/abilities y /api/search
```

## Forma de `sessions.data_json`

```json
{
  "types":     { "fuego": { "name_es": "Llama", "color": "#FF5500" } },
  "pokemon":   { "25": { "stats": { "spe": 120 }, "types": ["electrico", "hada"] } },
  "moves":     { "6": { "power": 110 } },
  "abilities": { "3": { "effect_es": "..." } },
  "relations": { "fuego": { "agua": 2 } },
  "theme":     { "base": "#0A1425", "panel": "#132238", "hover": "#1C3350",
                 "ink": "#F5F7FA", "inkSoft": "#A9BDD2" }
}
```

Lo que no aparece conserva el valor global.

## Prueba de humo (no necesita servidor ni SQLite)

```bash
node backend/tests/overrides.smoke.js
```

Simula `db`, `req` y `res` y comprueba seis cosas: el merge de un nivel en
`stats`, que sin `?session` la respuesta no se toca, que Pikachu
Eléctrico/Hada recalcula bien su efectividad (Dragón pasa a x0), que un
override de relaciones cambia la tabla, que listados y `/search` se
transforman, y que un cuerpo con formato inesperado no rompe nada.

Se ejecutó antes de empaquetar y pasa. El frontend también pasó `tsc --noEmit`
en modo estricto con React 18 y react-router 6, sin ningún error de tipos.

## Para el commit

En `docs/ROADMAP.md`, la Fase 3 pasa a completada:

```markdown
## ✅ Fase 3 — Sesiones personalizadas + Editor visual (completada)

| # | Tarea | Estado |
|---|-------|--------|
| 3.1 | CRUD de sesiones | ✅ `backend/routes/sessions.js`, `pages/Sessions.tsx` |
| 3.2 | Mecanismo de overrides | ✅ `backend/lib/overrides.js`, `middleware/sessionOverrides.js` |
| 3.3 | Editor visual de Pokémon | ✅ `components/forms/PokemonForm.tsx`, `pages/EditorPokemon.tsx` |
| 3.4 | Editores de tipos, movimientos, habilidades y relaciones | ✅ `components/forms/*`, `pages/Editor.tsx` |
| 3.5 | Editor de colores/tema por sesión | ✅ `lib/theme.ts`, `components/forms/ThemeForm.tsx` |
```

Y en `README.md`, el estado del proyecto: **Fase 3 completa**.

## Después de esto

El roadmap sigue con la **Fase 4** (importación / exportación JSON, CSV y
SQLite), que se apoya justo en este `data_json`.
