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
  data/        types.json, type_chart.json, pokemon.json, moves.json,
               abilities.json, items.json
               (18 tipos, 1025 Pokémon, 901 movimientos, 312 habilidades,
                2151 objetos)
  tools/       fetch-dataset.js  (regenera los JSON desde PokeAPI)
               fetch-sprites.js  (baja los 1025 sprites a frontend/public/sprites/)
  db/          schema.sql, seed.js, populate.js, migrate.js, paths.js
               (`pnpm run seed` BORRA la base y la recrea: se lleva perfiles,
                sesiones, favoritos, historial y ajustes. Los datos nuevos
                entran por migrate.js)
  lib/         effectiveness.js, catalog.js, overrides.js, typechart.js,
               dataset.js, importValidator.js, pin.js, pinThrottle.js,
               championsFilter.js
  middleware/  sessionOverrides.js, championsMode.js
  routes/      types.js, pokemon.js, moves.js, abilities.js, items.js,
               search.js, sessions.js, chart.js, export.js, import.js,
               profiles.js, favorites.js, history.js, settings.js,
               champions.js
  tests/       overrides.smoke.js, history.smoke.js, champions.smoke.js,
               championsMode.smoke.js
  server.js
frontend/src/
  components/  TopBar, SearchBar, TypeBadge, EffectivenessPanel,
               TeamSlotCard, RivalSlotCard, RecommendationCard, CoverageMap,
               SessionRequired, ImportPanel,
               PinPad, PinDialog, FavoriteButton, NotAllowed
  components/forms/  FormField, EntityPicker, PokemonForm, TypeForm, MoveForm,
                     AbilityForm, RelationsMatrix, ThemeForm
  pages/       Home, PokemonDetail, TypeDetail, MoveDetail, AbilityDetail,
               TeamBuilder, Sessions, Editor, EditorPokemon, ImportExport,
               ProfileSelect, Favorites, History, Settings, ChampionsRules,
               ChampionsHome
  hooks/       useSessionOverride.ts
  lib/         api.ts, apiSession.ts, session.ts, profile.ts, favorites.ts,
               history.ts, settings.ts, champions.ts, theme.ts, team.ts,
               damage.ts, recommendation.ts, coverage.ts
  i18n/        es.json, en.json, index.tsx
  types.ts, App.tsx, main.tsx, index.css, theme-vars.css
```

Rutas del frontend: `/`, `/perfiles`, `/pokemon/:id`, `/tipo/:id`, `/movimiento/:id`, `/habilidad/:id`, `/favoritos`, `/historial`, `/ajustes`, `/equipo`, `/sesiones`, `/editor`, `/editor/pokemon`, `/datos`, `/champions`, `/champions/reglas`.

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

### Historial y ajustes (Tarea 5.4) — dónde va cada preferencia

Las tres decisiones que quedaban abiertas antes de la 5.4 están **tomadas**:

**1. El idioma va en `profiles.language`, NO en `settings`.** El perfil activo se
cachea entero en `localStorage`, así que su idioma está disponible en el primer
render y sin conexión; con `settings` haría falta una petición antes de saber en
qué idioma pintar. `localStorage.pamudex_lang` se conserva como respaldo (antes
de elegir perfil). Lo aplica `i18n/index.tsx`, que además reacciona al cambio de
perfil. **No dupliques el idioma en `settings`.**

**2. El tema: la sesión pisa al perfil.** `profiles.theme` es el nombre de una
paleta del catálogo cerrado `PROFILE_THEMES` de `lib/theme.ts` (`oled`, `abismo`,
`bosque`, `brasa`, `ciruela`; ninguna con negro puro). El tema libre por sesión
de la Fase 3.5 manda mientras esa sesión esté activa, porque un ROM Hack tiene
identidad visual propia; si la sesión no define tema, se cae al del perfil.
`useAppTheme()` (antes `useSessionTheme()`) resuelve la precedencia y se llama
una sola vez, en `App.tsx`.

**3. La deduplicación del historial la hace la ruta.** `history` no tiene índice
único, y no debe tenerlo: es una bitácora, la misma ficha aparece muchas veces.
`routes/history.js` descarta la visita si esa entidad ya se registró para ese
perfil hace menos de **5 minutos**, mirando el `viewed_at` de la última. El
frontend repite la ventana en memoria solo para no mandar peticiones inútiles.
El historial además tiene techo: se conservan las **300** visitas más recientes
por perfil (lo escribe la app sola, sin poda crecería sin fin).

`settings` queda para lo que no merece columna, con **lista blanca** de claves en
`backend/routes/settings.js` (hoy `active_session`, `history_enabled`,
`champions_rules`, `high_contrast` y `text_scale`). Añadir una preferencia =
añadirla a `ALLOWED_KEYS` y a `ProfileSettings`.

**La sesión de ROM Hack pasó a ser de cada perfil.** `localStorage` sigue siendo
la fuente de verdad inmediata (`lib/api.ts` la lee de forma síncrona en cada
petición) y `settings.active_session` es la copia que se restaura al cambiar de
perfil. Lo gestiona `lib/settings.ts` colgándose del evento de cambio de sesión,
así que funciona desde cualquier sitio que la cambie. Un perfil sin preferencia
guardada **adopta** la sesión que hubiera al arrancar la app (para no perder el
ROM Hack abierto al actualizar) pero la **limpia** al entrar desde otro perfil.

Las fichas registran su visita con una línea: `useRecordVisit(tipo, id)` de
`lib/history.ts`, con el **id interno**, nunca el `:id` de la URL (que en Pokémon
puede ser el nº de Pokédex).

### El Service Worker NO puede cachear datos mutables como el dataset

`vite.config.ts` tiene dos reglas de `runtimeCaching`, **y el orden importa**:

- `/api/(favorites|profiles|sessions|history|settings)` → **NetworkFirst**. Son
  datos que el usuario modifica desde la app. Con StaleWhileRevalidate se veían con una
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
- `GET|POST|DELETE /api/history?profile=<id>[&limit=50]` → `{ profile_id, limit, items[] }`
  · POST responde `registrado: false` si lo descartó por duplicado reciente
- `GET|PUT /api/settings/:profileId` → `{ profile_id, settings }`. PUT **fusiona**
  (lo que no se envía conserva su valor) y `null` borra una clave

`/history` y `/favorites` devuelven **referencias, no nombres**; los resuelve el
frontend con los listados cacheados y así respetan los overrides de la sesión.
El perfil viaja en la query (`?profile=`) en las colecciones y en la URL en
`/settings/:profileId`, que es un documento único del perfil.

### Objetos (Tarea 6.0)

- `GET /api/items[?category=&q=]` → `{ id, name_es, name_en, category }[]`
- `GET /api/items/categories` → `{ category, total }[]` · `GET /api/items/:id` (+ `effect_es`)

**2151 objetos en 54 categorías** (`backend/data/items.json`). Tres cosas que no
son obvias:

- **No hay campo «equipable».** PokeAPI no lo sabe: el Chaleco Asalto y el Casco
  Dentado llegan sin `attributes` y en cambio la Poción trae `holdable`.
  Inventarlo se equivocaría en las dos direcciones, así que para acotar los
  objetos de combate se usa `category`.
- **El listado admite filtros**, al revés que `/pokemon`, `/moves` y
  `/abilities`, que devuelven todo. Son 394 KB: filtrar en SQLite sale más
  barato que mandarlo entero para descartarlo en el cliente. El listado no
  incluye `effect_es`; la descripción llega con la ficha.
- **Los objetos no pasan por el middleware de overrides ni por la exportación e
  importación de la Fase 4.** Un ROM Hack todavía no puede reescribirlos y un
  `.sqlite` exportado no los lleva. Pendiente, no olvido.

**Una entidad nueva del dataset NO se incorpora resembrando.** `pnpm run seed`
borra la base entera y con ella perfiles, sesiones, favoritos, historial y
ajustes. Los objetos entran por `db/migrate.js`, que los siembra desde
`data/items.json` **solo si la tabla está vacía**: idempotente, aditivo, y
respeta a quien los haya editado.

### Reglas de Pokémon Champions (Tarea 6.1)

- `GET|POST /api/champions`, `GET|PUT|DELETE /api/champions/:id`
- `GET /api/champions/:id/pokemon|moves|abilities|items` → el catálogo **ya
  filtrado**, con la misma forma que los listados normales

**`null` NO es lo mismo que `[]`.** Es la decisión de diseño de la tarea:
columna a NULL = **sin restricción** (vale todo el catálogo), `[]` = **nada
permitido**, `[1,4,7]` = solo esos. Así un conjunto recién creado ya sirve, en
vez de obligar a marcar 1025 casillas para poder consultar algo. Cada entidad se
restringe por su cuenta: un formato que solo limita objetos no dice nada de los
movimientos. Lo resuelve `backend/lib/championsFilter.js`.

`champions_rules` **no tiene `profile_id`**: los conjuntos de reglas son del
hogar. Lo que será de cada perfil es cuál tiene puesto, y eso va en `settings`
(lo montará la 6.3).

El PUT es **parcial** y valida todo antes de escribir nada, así que un cuerpo
inválido no deja el conjunto a medias.

### Multiplicadores propios del modo (Tarea 6.2)

- `PUT /api/champions/:id` acepta `multipliers` (`null` restablece los de siempre)
- `GET /api/champions/:id/pokemon/:pokeId` y `/types/:typeId` → la misma ficha
  que `/api/pokemon/:id` y `/api/types/:id`, con la **efectividad recalculada**

**Las CLAVES son canónicas, los VALORES no.** `hiper_eficaz`, `super_eficaz`,
`normal`, `poco_eficaz`, `muy_poco_eficaz` y `sin_efecto` no se pueden renombrar
ni ampliar: son lo que comparan `lib/damage.ts` y `EffectivenessPanel.tsx`. Un
conjunto de reglas solo cambia el número que se enseña en cada categoría.

`lib/effectiveness.js` es una **factoría**, `createEffectiveness(db, multipliers)`.
Su recorrido va **clave → valor**: el producto de la tabla de tipos decide la
categoría (eso sale del cruce de tipos y no lo cambia nadie) y el conjunto de
reglas decide el número. Al revés —agrupar por número, como hacía antes— poner
«hiper eficaz» a x3 metía esos tipos en el cubo de x2.

La API devuelve la tabla **completa** más `multipliers_custom`, para que el
frontend no tenga que conocer los valores por defecto del proyecto.
`EffectivenessPanel` indexa etiqueta y color **por `key`**, nunca por el número.

Una ficha que el conjunto no permite responde **404**: en ese modo no existe.
Los **tipos no se filtran**, son la física del juego y no contenido.

Champions **no toca el modo estándar ni las sesiones**: no reescribe datos, solo
dice qué contenido es legal. Por eso lee el catálogo global, sin overrides.

### Caché local (Fase 8) — leer antes de tocar `lib/api.ts`

`lib/localCache.ts` guarda el catálogo en **IndexedDB** y `lib/api.ts` lo lee
**primero**, refrescando por detrás. La interfaz nunca espera a la red si hay
copia local. No sustituye al Service Worker: aquél da tolerancia a fallos, esto
da los **100 ms** del requisito (medido: 1.1 ms de media).

Reglas que hay que mantener:

- **La clave es la ruta con el modo dentro** (`?session=`, `?champions=`). Sin
  eso, cambiar de ROM Hack serviría el catálogo del anterior.
- **Al escribir overrides hay que invalidar** con `invalidarSesion(id)`. Lo hace
  `useSessionOverride` en su único camino de escritura (`persist`).
- **Solo van los cuatro listados y las 18 fichas de tipo.** Las demás fichas son
  más de 2200: se quedan con el Service Worker. Si añades algo, que sea porque
  cabe y se usa en muchas páginas.
- **Un fallo de red NO es un 404.** `lib/api.ts` lanza `ApiError` con `status`, y
  `esFalloDeRed()` los distingue. Una ficha nueva debe enseñar
  `components/LoadError.tsx` sin red y `NotAllowed` solo ante un 404 real; tratar
  todo igual hacía decir «no permitida en Champions» estando sin cobertura.
- **Prueba en modo avión.** Es donde salen los fallos que con conexión no se ven:
  spinners infinitos y mensajes de error equivocados.

### PWA: iconos y actualizaciones (Fase 8) — leer antes de tocar el service worker

**El service worker se registra a mano** en `lib/serviceWorker.ts`, llamado
desde `main.tsx`; `injectRegister` está en `null` en `vite.config.ts` para que
el plugin no inyecte el suyo. No uses `virtual:pwa-register/react`: importa
`workbox-window`, que no está instalado, y **rompe `pnpm run build`**.

`registerType` es **`prompt`**, no `autoUpdate`: la versión nueva se queda en
espera y la aplica el usuario desde la franja de `components/UpdatePrompt.tsx`.
No lo cambies a `autoUpdate` sin pensarlo — recargaría la página sin avisar, y
en mitad de una edición del editor de ROM Hacks eso pierde trabajo.

**El icono maestro es `public/icons/icon.svg`**; los PNG y el `.ico` se generan
desde él (el comando está en el README). Si tocas el diseño, regenera los cinco
archivos. El `maskable` es un SVG **distinto** (`icon-maskable.svg`): va a
sangre, sin esquinas redondeadas, porque el sistema aplica su propia máscara.

**Las notificaciones no piden permiso solas, nunca.** Solo desde el interruptor
de `/ajustes`. Es preferencia del APARATO (`localStorage`) y no del perfil,
porque el permiso lo concede el navegador al sitio entero. Con el permiso
denegado no se guarda como activada: no llegaría ningún aviso y sería mentir.
Hoy hay un único caso de uso —avisar de que hay versión nueva— y añadir otros
debería pasar por el mismo listón: que ocurra con la app en segundo plano.

### Accesibilidad (Fase 8) — leer antes de tocar colores o tamaños

`lib/a11y.ts` guarda dos preferencias: **alto contraste** y **escalado de texto**
(90 / 100 / 115 / 130 %). Mismo patrón que `lib/session.ts`: estado de módulo +
eventos de `window`, `localStorage` como verdad inmediata, **no** un context.

**Se aplican antes de montar React**, con `applyA11y()` en `main.tsx`: la clase
`.high-contrast` en `<html>` y `font-size` en la raíz. Si se aplicaran en un
efecto, la app parpadearía con el tamaño equivocado.

**No son columnas de `profiles` aunque se parezcan al tema.** Se resuelven como
`active_session`: `localStorage` manda, y `settings.high_contrast` /
`settings.text_scale` son la copia por perfil que se restaura al cambiar de uno
a otro. Motivo: en `/perfiles` todavía no hay perfil del que leer nada, y esa es
justo la pantalla donde alguien que necesita alto contraste más lo echaría de
menos. La regla es la otra mitad de la de la sesión: **al arrancar manda el
aparato** (y se copia al perfil), **al cambiar de perfil manda el perfil**.

**El alto contraste pisa al tema de sesión y al del perfil.** `lib/theme.ts`
escribe las `--color-*` como estilo *inline* en `<html>`, así que `.high-contrast`
las redeclara con `!important` — lo único que gana a un inline. La identidad
visual de un ROM Hack no puede dejar la app ilegible.

En ese modo `panel` y `base` son **el mismo negro puro**; las tarjetas se
distinguen por un `outline` blanco de 1px con `outline-offset: -1px`, que se
dibuja *dentro* de la caja y por tanto no mueve ningún diseño. Es la única
excepción a la regla del negro puro en todo el proyecto, y la activa el usuario.

**Teclado y lectores (8.2).** Hay dos hooks y NO son intercambiables:
`hooks/useMenu.ts` para menús (el foco viaja a la opción) y
`hooks/useCombobox.ts` para autocompletados (el foco se queda en el campo y la
opción activa va con `aria-activedescendant`). Si añades un desplegable o un
autocompletado, usa el que toque en vez de escribir el teclado a mano.

Reglas que hay que mantener:

- **`<main id="contenido">` está en `App.tsx`, no en las páginas.** Una página
  nueva NO debe traer su propio `<main>`: habría dos hitos y el enlace «saltar
  al contenido» dejaría de ser fiable. Cada página empieza por un `<h1>` y no
  se salta niveles de encabezado.
- **Todo control necesita nombre accesible**, y el marcador de posición no
  cuenta: desaparece al escribir. Botón solo con icono -> `aria-label`; icono
  decorativo dentro de un botón con texto -> `aria-hidden="true"`.
- **Texto sobre un color del dataset**: `readableInk(color)` de `lib/theme.ts`
  elige entre claro y oscuro por contraste. No pongas un color de texto fijo.
- **Los cambios importantes que ocurren lejos del control** se anuncian con
  `role="status" aria-live="polite"`, y la región va SIEMPRE montada: una que
  aparece y desaparece del DOM no se anuncia de forma fiable.

**El escalado va en `font-size` de la raíz**, así que arrastra todos los `rem` de
Tailwind (paddings, huecos, anchos máximos): es un zoom coherente, no letras más
grandes dentro de cajas del mismo tamaño. Al tocar diseño, compruébalo a **320px
de ancho con el 130 %**; los mínimos en `rem` (`min-w-[14rem]`) y los tamaños
fijos (`w-28`) hay que envolverlos en `min(…, 100%)`. Ojo con un detalle: **las
media queries NO ven el `font-size` de la raíz**, así que un punto de corte en
píxeles no se mueve al escalar y una fila que cabía deja de caber.

### Multi-generación (Fase 7) — leer antes de tocar el historial

**`?gen=<n>` es opcional en las cuatro rutas de ficha** (`/api/pokemon/:id`,
`/api/moves/:id`, `/api/abilities/:id`, `/api/types/:id`) y lo aplica
`middleware/generationMode.js`. **Ninguna ruta de datos conoce las
generaciones**, igual que no conocen las sesiones ni Champions.

Toda ficha de esas cuatro entidades lleva dos campos, con `?gen=` o sin él:

- **`has_generational_differences`** (booleano) — decide si el frontend pinta el
  `GenerationSelector`.
- **`generational_changes`** (array, Tarea 7.2) — la lista de cambios, ordenada
  de la generación más antigua a la más nueva, con `old_value`/`new_value` ya
  parseados de JSON. Vacía si no hay ninguno.

En el resto de rutas y en los listados no se añade nada.

**Los cambios viajan EMBEBIDOS.** `ChangeTag` y `ChangeHistory` los pintan sin
pedir nada al servidor, así que funcionan sin conexión con la respuesta que el
Service Worker ya cacheó.

Existe además **`GET /api/changes/:entityType/:entityRef`** (`routes/changes.js`),
que devuelve `{ entity_type, entity_ref, has_generational_differences, changes }`
y sirve para consultar el historial **sin cargar una ficha entera** — es lo que se
usa para comprobar una entrada recién añadida al JSON. La interfaz no la usa.
**No está en `/api/history`**, que desde la Tarea 5.4 es el historial de consultas
por perfil y es otra cosa.

#### Cómo se amplía el historial

El conjunto vive en `backend/data/entity_changes.json` — **49 cambios, inicial y
corto a propósito**. Las instrucciones completas están en el README, sección
«Historial de cambios entre generaciones». Lo esencial:

- `ref` es la **clave natural**, no el id interno: nº de Pokédex en Pokémon,
  `name_es` en movimientos y habilidades, id en tipos. Los resuelve
  `db/populate.js` → `insertEntityChanges`, que salta con aviso lo que no
  resuelva en vez de romper el arranque.
- Entra por **`db/migrate.js`** cuando la tabla está vacía, nunca resembrando.
- **`pnpm run check:changes`** (`tools/check-entity-changes.js`) valida contra la
  base real las dos invariantes que nada más puede comprobar: que las cadenas
  empalmen y que el último eslabón cuadre con el dataset. Escribiendo el conjunto
  inicial pilló un par Bicho/Veneno con los `new_value` intercambiados. **Ejecútalo
  siempre que toques el archivo.**

**Limitación conocida:** los tipos que aún no existían siguen apareciendo en las
vistas antiguas (Acero, Siniestro y Hada salen en la tabla de la Gen 1). Haría
falta una generación de nacimiento por tipo, que el dataset no guarda.

**Este middleware SÍ actúa sin su parámetro**, a diferencia de los otros dos:
tiene que poner el indicador aunque el usuario no haya elegido generación.

**Se monta el ÚLTIMO de los tres** (`server.js`). Los wrappers de `res.json` se
aplican en orden inverso al de montaje, así que el orden real de transformación
es **generación → sesión → Champions**: se reconstruye el dato histórico y
encima pisan los overrides del ROM Hack, que son una edición explícita. `?gen=`
y `?session=` **se combinan** (Champions sigue siendo excluyente con la sesión).

#### La tabla `entity_changes` y cómo se lee

`entity_changes(id, entity_type, entity_ref, generation, field, old_value,
new_value, note)`. Una fila se lee «en la generación N este campo pasó de
`old_value` a `new_value`»: la generación es la de **entrada en vigor**.

El dataset sembrado son los valores de **hoy** y no hay copia del catálogo por
generación, así que el valor en una generación G es el `old_value` del cambio
**más antiguo posterior a G** — se camina hacia atrás (`lib/generations.js`).
Consecuencias al cargar datos (7.3): cada cambio de un campo debe **empalmar**
con el siguiente (`new_value` de uno = `old_value` del otro) y el último de la
cadena debe coincidir con lo que hay en la base; una entrada mal fechada
desplaza todo lo anterior de ese campo.

- `entity_type` es el **singular** de `favorites` e `history` (`pokemon`,
  `move`, `ability`, `type`), no el plural de las URLs.
- `entity_ref` es el **id interno** (cadena en los tipos: `'acero'`). En Pokémon
  se compara contra el id de la RESPUESTA, porque la URL admite el nº de Pokédex.
- `old_value` / `new_value` van en **JSON**, no en texto plano: los campos no son
  todos del mismo tipo (`power` número, `category` cadena, `types` array).
- Los cambios de la tabla de tipos se anotan en el tipo **DEFENSOR** con
  `field = 'relation:<atacante>'`. Acero perdiendo su resistencia a Fantasma en
  la Gen 6 es `entity_ref='acero'`, `field='relation:fantasma'`, `old_value=0.5`.
  Un tipo cuenta como «con diferencias» también cuando el cambio está anotado en
  otro: su perfil ofensivo se movió igual. En la respuesta, esos cambios «desde
  el otro lado» salen con el prefijo **sintético** `relation_out:<defensor>`,
  que no existe en la base — lo compone `changesFor`. Constantes del frontend en
  `lib/generations.ts`.
- `field` admite **un nivel de anidamiento con punto** (`stats.atk`).

La tabla **está vacía a propósito hasta la 7.3**: la 7.1 es solo la
infraestructura. Los datos entran por `db/migrate.js` o por la siembra, nunca
resembrando (`pnpm run seed` borra perfiles, sesiones, favoritos e historial).

`lib/buckets.js` (`rebuildGroups`) es la reconstrucción de los grupos de
efectividad sobre una tabla de tipos modificada. Vivía dentro de
`sessionOverrides.js` y se extrajo en la 7.1, que la necesitaba igual. Lo usan
los dos middlewares.

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

- **Paleta OLED, nunca negro puro**: base `#0A1425`, panel `#132238`, hover `#1C3350`, texto `#F5F7FA`, texto secundario `#A9BDD2`. En Tailwind: `bg-base`, `bg-panel`, `bg-hover`, `text-ink`, `text-ink-soft`. La **única** excepción es el modo de alto contraste de la 8.1, que el usuario activa a mano.
  - **`text-base` es el tamaño de letra, no un color.** El color `base` se declara solo en `backgroundColor` y `borderColor` de `tailwind.config.js`, no en `colors`: metido en `colors` generaba un segundo `.text-base { color: var(--color-base) }` que pisaba al de Tailwind y pintaba el texto del color del fondo. No lo devuelvas a `colors`.
- **Texto sobre un color del dataset o del usuario**: clase `color-chip` + `--chip-color` en el `style`. En alto contraste esa clase cambia el fondo de color por un marco de 2px y pone el texto en blanco sobre negro, porque los tipos apagados no llegan a AAA. Lo usan `TypeBadge` y los avatares de perfil.
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
- ✅ **Fase 5**: usuarios y perfiles.
  - ✅ **5.1** pantalla de perfiles en `/perfiles` + perfil activo en `localStorage`.
  - ✅ **5.2** PIN opcional de 4 dígitos por perfil (`profiles.pin_hash`, scrypt).
  - ✅ **5.3** favoritos por perfil en `/favoritos` (tabla `favorites`).
  - ✅ **5.4** historial en `/historial` y ajustes en `/ajustes` (tablas `history`
    y `settings`), idioma y tema por perfil, sesión de ROM Hack por perfil.
- ✅ **Fase 6**: Pokémon Champions, modo aparte en `/champions`.
  - ✅ **6.0** objetos en el dataset (`/api/items`), tarea añadida al preparar la
    fase porque la 6.1 no tenía objetos que filtrar.
  - ✅ **6.1** base de reglas en `/champions/reglas` (`champions_rules`,
    `lib/championsFilter.js`, `routes/champions.js`).
  - ✅ **6.2** multiplicadores propios del modo (`custom_multipliers_json`),
    con `lib/effectiveness.js` convertido en factoría.
  - ✅ **6.3** el modo en sí: `middleware/championsMode.js` con `?champions=<id>`,
    `lib/champions.ts`, `/champions` y el distintivo permanente de la TopBar.
- ✅ **Fase 7**: multi-generación.
  - ✅ **7.1** infraestructura: tabla `entity_changes`, `lib/generations.js`,
    `middleware/generationMode.js` con `?gen=<n>`,
    `has_generational_differences` en las cuatro fichas y
    `components/GenerationSelector.tsx`. Ver «Multi-generación (Fase 7)».
  - ✅ **7.2** vista «Todas las generaciones»: `generational_changes` embebido en
    la ficha, `components/ChangeTag.tsx` (pulsación **y** hover, con teclado) y
    `lib/generations.ts`. «Todas» **sustituyó** a «Actual» como valor `null` por
    defecto del selector; elegir una generación concreta apaga las etiquetas,
    porque allí el dato ya es el histórico.
  - ✅ **7.3** `backend/data/entity_changes.json` (49 cambios documentados),
    siembra por `db/migrate.js`, `GET /api/changes/:tipo/:ref`,
    `components/ChangeHistory.tsx` (colapsable, cerrada por defecto) y el
    validador `pnpm run check:changes`.
- 🚧 **Fase 8, en curso**: accesibilidad, rendimiento y PWA avanzada.
  - ✅ **8.1** alto contraste real y escalado de texto: `lib/a11y.ts`, la clase
    `.high-contrast` de `index.css`, cuatro niveles (90/100/115/130 %) y la
    sección «Accesibilidad» de `/ajustes`. Ver «Accesibilidad (Fase 8)».
  - ✅ **8.2** teclado y lectores de pantalla: `hooks/useMenu.ts`,
    `hooks/useCombobox.ts`, un único `<main>` con enlace de salto en `App.tsx`,
    `readableInk` para el texto de los distintivos y región `aria-live` en el
    comparador. Ver «Accesibilidad (Fase 8)».
  - ✅ **8.3** iconos definitivos y notificaciones opcionales:
    `public/icons/icon.svg` como maestro, manifiesto completo,
    `lib/serviceWorker.ts`, `lib/notifications.ts` y `components/UpdatePrompt.tsx`.
    Ver «PWA: iconos y actualizaciones (Fase 8)».
  - ✅ **8.4** caché local y rendimiento: `lib/localCache.ts` (IndexedDB),
    `lib/perf.ts`, `components/OfflineData.tsx` y `components/LoadError.tsx`.
    Medido: 1.1 ms de media leyendo el catálogo. Ver «Caché local (Fase 8)».
- 🔜 **Fase 9, la siguiente**: ampliaciones (calculadora de daño, simulador,
  recomendador de equipos). Es la fase más abierta: usa
  `docs/AI_TASK_TEMPLATE.md` para partirla. Ver `docs/ROADMAP.md`.

## Tablas SQLite ya creadas pero SIN lógica todavía

Ninguna. `champions_rules` la estrenó la 6.1.

Ya en uso: `sessions` (Fase 3), `profiles` (5.1 y 5.2), `favorites` (5.3),
`history` y `settings` (5.4), `items` (6.0), `champions_rules` (6.1). `users`
existe pero **sigue vacía a propósito**: se reserva para un login real.

`entity_changes` (7.1) existe y tiene lógica, pero **está vacía hasta la 7.3**:
sin filas, la app se comporta exactamente igual que antes de la Fase 7.

## Decisiones ya tomadas, no las reabras sin motivo

Las tres de la 5.4 (idioma, tema e historial) están documentadas más arriba, en
«Historial y ajustes (Tarea 5.4)».

Las cinco de la Fase 6 se decidieron en **`docs/tasks/fase6/00-preparacion.md`**,
porque los encargos `06-01`, `06-02` y `06-03` se escribieron antes de que
existieran las fases 3, 4 y 5:

1. El filtro llega por **middleware con `?champions=<id>`**, como los overrides
   de la Fase 3. Las rutas `/api/champions/:id/pokemon` quedan para el editor de
   reglas, no para la consulta.
2. Champions y las sesiones de ROM Hack son **excluyentes**: entrar en el modo
   pausa la sesión, que se restaura al salir desde `settings.active_session`.
3. `custom_multipliers_json` cambia los **valores** de `hiper_eficaz`,
   `super_eficaz`… pero **nunca las claves**, que son valores canónicos contra
   los que comparan `lib/damage.ts` y `EffectivenessPanel.tsx`.
4. El conjunto de reglas activo es **de cada perfil**, en `settings` (los
   conjuntos en sí son del hogar: `champions_rules` no tiene `profile_id`).
5. Los objetos ya existen: se hizo la **tarea 6.0** antes que la 6.1.

### El modo Champions en marcha (Tarea 6.3)

`?champions=<id>` lo aplica **`backend/middleware/championsMode.js`**, montado
con `app.use("/api", championsMode(db))` **antes** que `sessionOverrides`:
intercepta `res.json`, filtra los listados y `/search`, responde **404** en una
ficha no permitida y remapea los multiplicadores por clave. Sin el parámetro
hace `next()` y la API responde igual que siempre. **Ninguna ruta de datos
conoce el modo — no las modifiques para añadirle soporte, ya lo tienen.**

Va antes que `sessionOverrides` a propósito: si llegan los dos parámetros,
descarta `?session=`. Los dos modos son excluyentes y manda Champions.

En el frontend, **`lib/champions.ts`** (no un context de React: `lib/api.ts`
tiene que leer el modo de forma síncrona en cada petición, igual que la sesión).
Guarda `{ id, name }` porque la TopBar pinta el nombre en el distintivo desde el
primer render. Entrar **pausa** la sesión de ROM Hack y salir la devuelve;
`setActiveSessionId(id, silent)` marca esos cambios para que `lib/settings.ts` no
los guarde como preferencia del perfil.

Las páginas de ficha son **las mismas** dentro y fuera del modo. Por eso las tres
que pueden dar 404 (Pokémon, movimiento, habilidad) pintan
`components/NotAllowed.tsx`: se llega a una ficha prohibida desde los favoritos,
el historial o escribiendo la URL.

Lo que **no** filtra el modo: los tipos y la tabla de tipos (son la física del
juego, no contenido) y `/equipo`, cuyos datos viven en `localStorage`.

Recordatorio permanente: si añades endpoints que el usuario pueda modificar,
**mételos en la regla NetworkFirst de `vite.config.ts`** o se verán con una
navegación de retraso.
