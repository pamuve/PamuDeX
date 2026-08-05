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
               (18 tipos, 1025 Pokémon, 901 movimientos, 312 habilidades)
  tools/       fetch-dataset.js  (regenera los JSON desde PokeAPI)
  db/          schema.sql, seed.js, populate.js  (la DB se genera con `pnpm run seed`)
  lib/         effectiveness.js, overrides.js, typechart.js,
               dataset.js, importValidator.js
  middleware/  sessionOverrides.js
  routes/      types.js, pokemon.js, moves.js, abilities.js, search.js,
               sessions.js, chart.js, export.js, import.js, profiles.js
  tests/       overrides.smoke.js
  server.js
frontend/src/
  components/  TopBar, SearchBar, TypeBadge, EffectivenessPanel,
               TeamSlotCard, RivalSlotCard, RecommendationCard, CoverageMap,
               SessionRequired, ImportPanel
  components/forms/  FormField, EntityPicker, PokemonForm, TypeForm, MoveForm,
                     AbilityForm, RelationsMatrix, ThemeForm
  pages/       Home, PokemonDetail, TypeDetail, MoveDetail, AbilityDetail,
               TeamBuilder, Sessions, Editor, EditorPokemon, ImportExport,
               ProfileSelect
  hooks/       useSessionOverride.ts
  lib/         api.ts, apiSession.ts, session.ts, profile.ts, theme.ts,
               team.ts, damage.ts, recommendation.ts, coverage.ts
  i18n/        es.json, en.json, index.tsx
  types.ts, App.tsx, main.tsx, index.css, theme-vars.css
```

Rutas del frontend: `/`, `/perfiles`, `/pokemon/:id`, `/tipo/:id`, `/movimiento/:id`, `/habilidad/:id`, `/equipo`, `/sesiones`, `/editor`, `/editor/pokemon`, `/datos`.

### Perfiles y PIN (Tareas 5.1 y 5.2) — leer antes de tocar perfiles

`GET/POST/PUT/DELETE /api/profiles` (+ `GET /api/profiles/palette`) sobre la tabla
`profiles`. Todavía no hay login: `user_id` se guarda como **NULL**, igual que
`sessions.profile_id` en la Fase 3.

**El PIN de perfil vive en `profiles.pin_hash`, NO en `users.password_hash`.**
Son cosas distintas y se mantienen separadas a propósito: `users` es la
credencial de cuenta (login real, si algún día se expone la app) y queda sin usar;
`pin_hash` es el bloqueo blando entre convivientes, como el PIN de Netflix.
Endpoints: `POST /:id/verify`, `POST /:id/password`, `DELETE /:id/password`.

Hash con `scrypt` de `node:crypto` (`lib/pin.js`), sal aleatoria por perfil, sin
dependencias nuevas. **El hash no sale nunca de la API**: las respuestas exponen
`has_pin` (booleano) y jamás `pin_hash`. Límite de intentos con pausa creciente
en `lib/pinThrottle.js`, en memoria, aplicado también a cambiar y quitar el PIN
(si no, la fuerza bruta se haría contra esos endpoints).

Las columnas nuevas se añaden en `db/migrate.js`, que corre en cada arranque y es
idempotente. **Solo migraciones aditivas**: `schema.sql` únicamente se ejecuta al
sembrar desde cero, y una instalación en marcha no puede perder sus sesiones.

La ruta del archivo SQLite sale de `db/paths.js` (`PAMUDEX_DB_DIR`): en local
`backend/db/pamudex.sqlite`, en Docker `/data`. **`backend/db/` es código**, así
que el volumen no puede montarse ahí — Docker solo copia a un volumen vacío y el
código quedaría congelado en la versión del primer despliegue.

El perfil activo se guarda **entero** (no solo su id) en `localStorage` bajo
`pamudex_active_profile`, porque la TopBar lo pinta en el primer render y la app
es offline-first. Toda la app pasa por `lib/profile.ts` (`getActiveProfile()`,
`useActiveProfile()`), nunca lee la clave directamente.

Los perfiles se piden con `session: false`: no dependen de la sesión de ROM Hack
y añadir `?session=` solo fragmentaría la caché del Service Worker.

Borrar un perfil arrastra sus `sessions`, `settings` e `history` por
ON DELETE CASCADE — better-sqlite3 activa `PRAGMA foreign_keys` en cada conexión,
así que se aplica en caliente. El DELETE devuelve `sessions_borradas`.

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

### Exportación e importación (Fase 4)

- `GET /api/export/json|csv|sqlite[?session=<id>]` — devuelven el **formato semilla** (`backend/data/*.json`), no el de la API.
- `POST /api/import/preview` y `/apply` (JSON y CSV), `POST /api/import/sqlite/preview` y `/apply`. Parámetros en la query: `target=session|global`, `session=`, `mode=merge|replace`, `format=`, `entity=`. El cuerpo es el archivo **en crudo** (`express.raw`), sin multipart.
- Flujo obligatorio: previsualizar → confirmar → aplicar. `apply` revalida desde cero; no hay estado guardado entre los dos pasos.
- `lib/dataset.js` construye el dataset con los overrides ya resueltos, y lo comparten exportación e importación: por eso reimportar un export propio da «0 cambios».
- **Los overrides parchean filas existentes, no crean nuevas.** Importar entidades nuevas dentro de una sesión no es posible: se informan y se omiten. Para darlas de alta hay que importar al dataset global.

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
- **El gestor de paquetes es pnpm, nunca npm ni npx.** `backend/` y `frontend/` son dos proyectos pnpm independientes (no un workspace), cada uno con su `pnpm-lock.yaml` versionado. El equivalente de `npx` es `pnpm exec`. Si añades una dependencia y pnpm avisa con `ERR_PNPM_IGNORED_BUILDS`, es que bloqueó su script de instalación: valóralo caso por caso y, si es legítimo, apruébalo en `pnpm-workspace.yaml` bajo `allowBuilds` (hoy solo `better-sqlite3` en backend y `esbuild` en frontend).
- Verificación final siempre: `cd frontend && pnpm exec tsc --noEmit && pnpm run build` sin errores, `node --check` en cada archivo de backend tocado, y paridad exacta de claves entre `es.json` y `en.json`.

## Valores canónicos del dataset

Respétalos: `lib/damage.ts` y `types.ts` comparan contra ellos.

- Categoría de movimiento: **`fisico` | `especial` | `estado`** (en español, sin tilde). Nunca `physical/special/status`.
- `makes_contact` es **`1` | `0` | `null`**. `null` significa *desconocido*, no *no*: PokeAPI no expone ese dato y solo 19 movimientos lo tienen puesto a mano. Al mostrarlo, `null` va como «—».
- Multiplicadores de efectividad: `4, 2, 1, 0.5, 0.25, 0`, con claves `hiper_eficaz`, `super_eficaz`, `normal`, `poco_eficaz`, `muy_poco_eficaz`, `sin_efecto`.

## Estado actual

- ✅ **Fase 1**: núcleo de tipos/Pokémon/movimientos/habilidades, buscador, PWA offline, Docker, i18n ES/EN.
- ✅ **Fase 2**: comparador de equipos en `/equipo` (equipo propio y rival en `localStorage`, motor de daño, recomendación "mejor respuesta", mapa de cobertura).
- ✅ **Fase 3**: sesiones de ROM Hack en `/sesiones` (CRUD en SQLite), overrides por sesión vía middleware, editor visual en `/editor` (Pokémon, tipos, movimientos, habilidades, matriz de relaciones) y tema de color por sesión.
- ✅ **Fase 4**: exportación e importación en JSON, CSV y SQLite desde `/datos`, con previsualización antes de aplicar (`routes/export.js`, `routes/import.js`, `lib/importValidator.js`).
- 🔜 Fases 5-9: ver `docs/ROADMAP.md`.

## Tablas SQLite ya creadas pero SIN lógica todavía

`items`, `users`, `profiles`, `settings`, `history`, `champions_rules`. Están en `backend/db/schema.sql` — reutilízalas antes de inventar tablas nuevas. (`sessions` ya está en uso desde la Fase 3.)
