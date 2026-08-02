# Contexto base de PamuDeX (pegar SIEMPRE junto al archivo de tarea)

Pega este archivo primero y, a continuación, el `.md` de la tarea concreta. Con estos dos, cualquier IA sin memoria del proyecto puede generar código coherente.

## Qué es

PamuDeX: PWA autoalojada y **offline-first** para consultar tipos, Pokémon, movimientos y habilidades, con comparador de equipos, sesiones de ROM Hack, editor visual, perfiles multiusuario y modo Pokémon Champions.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + `vite-plugin-pwa` + `react-router-dom` + `lucide-react`
- **Backend**: Node.js + Express + SQLite (`better-sqlite3`)
- **Despliegue**: Docker, contenedor único, el backend sirve el build del frontend

## Estructura de carpetas

```
backend/
  data/        types.json, type_chart.json, pokemon.json, moves.json, abilities.json
  db/          schema.sql, seed.js  (la DB se genera con `npm run seed`)
  lib/         effectiveness.js, overrides.js, typechart.js
  middleware/  sessionOverrides.js
  routes/      types.js, pokemon.js, moves.js, abilities.js, search.js,
               sessions.js, chart.js
  tests/       overrides.smoke.js
  server.js
frontend/src/
  components/  TopBar, SearchBar, TypeBadge, EffectivenessPanel,
               TeamSlotCard, RivalSlotCard, RecommendationCard, CoverageMap,
               SessionRequired
  components/forms/  FormField, EntityPicker, PokemonForm, TypeForm, MoveForm,
                     AbilityForm, RelationsMatrix, ThemeForm
  pages/       Home, PokemonDetail, TypeDetail, MoveDetail, AbilityDetail,
               TeamBuilder, Sessions, Editor, EditorPokemon
  hooks/       useSessionOverride.ts
  lib/         api.ts, apiSession.ts, session.ts, theme.ts,
               team.ts, damage.ts, recommendation.ts, coverage.ts
  i18n/        es.json, en.json, index.tsx
  types.ts, App.tsx, main.tsx, index.css, theme-vars.css
```

Rutas del frontend: `/`, `/pokemon/:id`, `/tipo/:id`, `/movimiento/:id`, `/habilidad/:id`, `/equipo`, `/sesiones`, `/editor`, `/editor/pokemon`.

## API REST existente (todas devuelven JSON plano, sin envoltorio)

- `GET /api/types` → `{ id, name_es, name_en, color }[]`
- `GET /api/types/:id` → lo anterior + `ofensivo` y `defensivo`: `{ multiplier, label, key, types: string[] }[]`
- `GET /api/pokemon` → `{ id, dex, name_es, name_en, generation }[]`
- `GET /api/pokemon/:id` → `{ id, dex, name_es, name_en, generation, types, abilities, hidden_ability, stats:{hp,atk,def,spa,spd,spe}, height_m, weight_kg, efectividad }`
- `GET /api/moves` → `{ id, name_es, name_en, type_id, color, category, power, accuracy, pp }[]`
- `GET /api/moves/:id` → lo anterior + `priority, makes_contact, generation, effect_es`
- `GET /api/abilities` y `/api/abilities/:id` (incluye `pokemon` que la poseen)
- `GET /api/search?q=` → `{ pokemon, types, moves, abilities }`

En `/api/pokemon/:id`, `abilities` es un **array de objetos** `{ name_es, name_en, effect_es, is_hidden }` y `hidden_ability` es **ese mismo objeto o `null`** (no cadenas sueltas).

### Sesiones y overrides (Fase 3)

- `GET|POST /api/sessions`, `GET|PUT|DELETE /api/sessions/:id`, `POST /api/sessions/:id/duplicate`
- `GET /api/chart[?session=<id>]` → tabla de tipos 18x18
- **`?session=<id>` es opcional en `/api/types`, `/api/pokemon`, `/api/moves`, `/api/abilities` y `/api/search`.**

Lo aplica `backend/middleware/sessionOverrides.js`, montado con `app.use("/api", sessionOverrides(db))` **antes** de las rutas de datos: intercepta `res.json` y mezcla encima los overrides de la sesión. Sin `?session=` hace `next()` y la API responde exactamente igual que en la Fase 1. Ninguna ruta de datos conoce las sesiones — **no las modifiques para añadir soporte de sesión, ya lo tienen**.

`frontend/src/lib/api.ts` añade `?session=` solo cuando hay sesión activa (`lib/session.ts` → `getActiveSessionId()`), así que cualquier página que use `api.*` respeta la sesión sin hacer nada.

Forma de `sessions.data_json`:

```json
{
  "types":     { "fuego": { "name_es": "Llama", "color": "#FF5500" } },
  "pokemon":   { "7": { "stats": { "spe": 120 }, "types": ["electrico", "hada"] } },
  "moves":     { "6": { "power": 110 } },
  "abilities": { "3": { "effect_es": "..." } },
  "relations": { "fuego": { "agua": 2 } },
  "theme":     { "base": "#0A1425", "panel": "#132238", "hover": "#1C3350",
                 "ink": "#F5F7FA", "inkSoft": "#A9BDD2" }
}
```

Lo que no aparece conserva el valor global. Dos reglas que no son obvias:

- **La clave es el `id` interno de la entidad, no el nº de Pokédex.** En el ejemplo, `"7"` es el id de Pikachu; su `dex` es 25. `/api/pokemon/:id` acepta las dos cosas (el id manda), pero `data_json` se indexa siempre por `id`, que es lo que devuelven los listados y lo que escribe el editor. Los tipos son la excepción natural: su id ya es la cadena (`"fuego"`).
- **Un override sustituye el campo entero**, así que tiene que guardarse con la misma forma que devuelve la API — por ejemplo `abilities` como array de objetos, no de cadenas.

## IDs de tipo (minúscula, sin tilde)

`normal, fuego, agua, electrico, planta, hielo, lucha, veneno, tierra, volador, psiquico, bicho, roca, fantasma, dragon, siniestro, acero, hada`

## Convenciones obligatorias

- **Paleta OLED, nunca negro puro**: base `#0A1425`, panel `#132238`, hover `#1C3350`, texto `#F5F7FA`, texto secundario `#A9BDD2`. En Tailwind: `bg-base`, `bg-panel`, `bg-hover`, `text-ink`, `text-ink-soft`.
- **Tarjetas**: `rounded-xl2 shadow-card bg-panel` + `animate-fadein` (ya definidos en `tailwind.config.js`).
- **i18n**: nunca texto suelto en JSX. Añade la clave a `src/i18n/es.json` Y `en.json`, y usa `useI18n().t("clave")`. Admite parámetros: `t("clave", { name: "X" })` sustituye `{{name}}`.
  - **Los JSON son PLANOS**: `"editor.fields.dex": "Nº de Pokédex"`. `i18n/index.tsx` hace `dict[key]` directo y **no recorre objetos anidados**: si pegas un bloque anidado, la app pinta la clave cruda. Si te entregan claves anidadas, aplánalas antes.
  - Los dos archivos deben tener **exactamente el mismo juego de claves**.
- **Componentes** reutilizables en `src/components/`, **páginas** con ruta propia en `src/pages/` + registrar la ruta en `src/App.tsx`.
- **Backend**: cada ruta es un módulo que exporta `(db) => router` y se monta en `server.js`.
- **Móvil primero**: debe funcionar desde 4" hasta escritorio (Steam Deck, ROG Ally, AYN Thor incluidos).
- Verificación final siempre: `cd frontend && npx tsc --noEmit && npm run build` sin errores, `node --check` en cada archivo de backend tocado, y paridad exacta de claves entre `es.json` y `en.json`.

## Valores canónicos del dataset

Respétalos: `lib/damage.ts` y `types.ts` comparan contra ellos.

- Categoría de movimiento: **`fisico` | `especial` | `estado`** (en español, sin tilde). Nunca `physical/special/status`.
- Multiplicadores de efectividad: `4, 2, 1, 0.5, 0.25, 0`, con claves `hiper_eficaz`, `super_eficaz`, `normal`, `poco_eficaz`, `muy_poco_eficaz`, `sin_efecto`.

## Estado actual

- ✅ **Fase 1**: núcleo de tipos/Pokémon/movimientos/habilidades, buscador, PWA offline, Docker, i18n ES/EN.
- ✅ **Fase 2**: comparador de equipos en `/equipo` (equipo propio y rival en `localStorage`, motor de daño, recomendación "mejor respuesta", mapa de cobertura).
- ✅ **Fase 3**: sesiones de ROM Hack en `/sesiones` (CRUD en SQLite), overrides por sesión vía middleware, editor visual en `/editor` (Pokémon, tipos, movimientos, habilidades, matriz de relaciones) y tema de color por sesión.
- 🔜 Fases 4-9: ver `docs/ROADMAP.md`.

## Tablas SQLite ya creadas pero SIN lógica todavía

`items`, `users`, `profiles`, `settings`, `history`, `champions_rules`. Están en `backend/db/schema.sql` — reutilízalas antes de inventar tablas nuevas. (`sessions` ya está en uso desde la Fase 3.)
