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
  db/          schema.sql, seed.js, populate.js, migrate.js, paths.js
               (la DB se genera con `pnpm run seed`)
  lib/         effectiveness.js, overrides.js, typechart.js,
               dataset.js, importValidator.js, pin.js, pinThrottle.js
  middleware/  sessionOverrides.js
  routes/      types.js, pokemon.js, moves.js, abilities.js, search.js,
               sessions.js, chart.js, export.js, import.js,
               profiles.js, favorites.js
  tests/       overrides.smoke.js
  server.js
frontend/src/
  components/  TopBar, SearchBar, TypeBadge, EffectivenessPanel,
               TeamSlotCard, RivalSlotCard, RecommendationCard, CoverageMap,
               SessionRequired, ImportPanel,
               PinPad, PinDialog, FavoriteButton
  components/forms/  FormField, EntityPicker, PokemonForm, TypeForm, MoveForm,
                     AbilityForm, RelationsMatrix, ThemeForm
  pages/       Home, PokemonDetail, TypeDetail, MoveDetail, AbilityDetail,
               TeamBuilder, Sessions, Editor, EditorPokemon, ImportExport,
               ProfileSelect, Favorites
  hooks/       useSessionOverride.ts
  lib/         api.ts, apiSession.ts, session.ts, profile.ts, favorites.ts,
               theme.ts, team.ts, damage.ts, recommendation.ts, coverage.ts
  i18n/        es.json, en.json, index.tsx
  types.ts, App.tsx, main.tsx, index.css, theme-vars.css
```

Rutas del frontend: `/`, `/perfiles`, `/pokemon/:id`, `/tipo/:id`, `/movimiento/:id`, `/habilidad/:id`, `/favoritos`, `/equipo`, `/sesiones`, `/editor`, `/editor/pokemon`, `/datos`.

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

### Favoritos (Tarea 5.3)

`GET/POST/DELETE /api/favorites?profile=<id>` sobre la tabla `favorites`
(creada en `schema.sql` y en `db/migrate.js`), con índice **único** en
`(profile_id, entity_type, entity_ref)`. `entity_type` ∈
`pokemon | move | ability | type`; `entity_ref` es TEXT porque los tipos usan
ids de texto y el resto enteros.

POST y DELETE son **idempotentes** (`INSERT OR IGNORE` contra el índice único),
así que el botón optimista no puede duplicar filas ni fallar por repetición.

La API devuelve **referencias, no nombres**: los resuelve el frontend con los
listados que ya tiene cacheados, y así los favoritos respetan los overrides de
la sesión de ROM Hack activa sin lógica extra.

El estado vive en `lib/favorites.ts` (caché de módulo + eventos de `window`,
igual que `lib/session.ts`), no en un context.

### El Service Worker NO puede cachear datos mutables como el dataset

`vite.config.ts` tiene dos reglas de `runtimeCaching`, **y el orden importa**:

- `/api/(favorites|profiles|sessions)` → **NetworkFirst**. Son datos que el
  usuario modifica desde la app. Con StaleWhileRevalidate se veían con una
  navegación de retraso (marcabas un favorito y no aparecía en `/favoritos`
  hasta la siguiente carga).
- El resto de `/api/` → StaleWhileRevalidate. El dataset solo cambia al
  reconstruir la imagen, así que interesa responder al instante desde la caché.

Si añades endpoints que el usuario pueda modificar, mételos en la primera regla.

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

### Perfiles y favoritos (Fase 5)

- `GET|POST /api/profiles`, `GET|PUT|DELETE /api/profiles/:id`, `GET /api/profiles/palette`
  → `{ id, user_id, name, avatar, color, language, theme, has_pin }` (**nunca `pin_hash`**)
- `POST /api/profiles/:id/verify`, `POST /api/profiles/:id/password`, `DELETE /api/profiles/:id/password`
- `GET|POST|DELETE /api/favorites?profile=<id>` → `{ profile_id, items[], byType }`

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
- 🔄 **Fase 5, en curso**:
  - ✅ **5.1** pantalla de perfiles en `/perfiles` + perfil activo en `localStorage`.
  - ✅ **5.2** PIN opcional de 4 dígitos por perfil (`profiles.pin_hash`, scrypt).
  - ✅ **5.3** favoritos por perfil en `/favoritos` (tabla `favorites`).
  - 🔜 **5.4** historial y ajustes por perfil. **Es la siguiente.**
- 🔜 Fases 6-9: ver `docs/ROADMAP.md`.

## Tablas SQLite ya creadas pero SIN lógica todavía

`items` y `champions_rules`. Están en `backend/db/schema.sql` — reutilízalas antes
de inventar tablas nuevas.

Ya en uso: `sessions` (Fase 3), `profiles` (5.1 y 5.2), `favorites` (5.3).
`users` existe pero **sigue vacía a propósito**: se reserva para un login real.
`settings` e `history` son las que toca activar en la 5.4.

## Antes de empezar la 5.4: tres decisiones que hay que tomar

La tarea 5.4 se topa con solapamientos que el encargo original no previó. **No
las resuelvas por inercia, decídelas y avisa antes de aplicarlas.**

**1. ¿El idioma va en `profiles.language` o en `settings`?**
Las dos existen. `profiles.language` se creó en la 5.1 y la API de perfiles ya
lo acepta en POST y PUT, pero **nadie lo lee todavía**: el idioma real vive en
`localStorage` bajo `pamudex_lang` (`i18n/index.tsx`). El encargo de la 5.4 pide
migrarlo a `settings`. Duplicarlo en los dos sitios acabaría en incoherencias.
Lo razonable es elegir uno: `profiles.language` ya está y evita una tabla de
por medio; `settings` es más flexible para preferencias futuras. Elige y deja el
otro explícitamente sin usar, documentándolo.

**2. ¿El tema es del perfil o de la sesión?**
`profiles.theme` existe desde la 5.1 (sin usar), pero `lib/theme.ts` de la Fase
3 aplica el tema de la **sesión de ROM Hack activa** mediante variables CSS. Si
la 5.4 añade tema por perfil, los dos compiten por las mismas `--color-*`. Hay
que definir la precedencia (lo natural: la sesión pisa al perfil mientras esté
activa) y dejarlo escrito.

**3. La deduplicación del historial no la da la base de datos.**
`history` **no tiene índice único** (a diferencia de `favorites`), y no debe
tenerlo: el historial es una bitácora, la misma ficha puede aparecer muchas
veces en momentos distintos. La regla de «no registrar dos veces la misma
entidad en menos de 5 minutos» hay que implementarla en la ruta, comprobando el
`viewed_at` de la última visita de esa entidad para ese perfil.

Recordatorio que aplica a las tres: si añades endpoints que el usuario pueda
modificar (`/api/history`, `/api/settings`), **mételos en la regla NetworkFirst
de `vite.config.ts`** o se verán con una navegación de retraso.
