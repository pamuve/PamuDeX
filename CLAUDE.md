# CLAUDE.md

Guía para trabajar en PamuDeX. Lee también `docs/tasks/_CONTEXTO_BASE.md`: es la
especificación que se pega en cada encargo de fase y manda sobre este archivo si
alguna vez se contradicen.

## Qué es

PWA autoalojada y **offline-first** tipo Pokédex para ROM Hacks de Pokémon
(Radical Red, Elite Redux…): tipos, Pokémon, movimientos, habilidades,
comparador de equipos, sesiones de ROM Hack con editor visual, perfiles
multiusuario y modo Pokémon Champions.

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + `vite-plugin-pwa` + `react-router-dom` + `lucide-react`
- **Backend**: Node.js + Express + SQLite (`better-sqlite3`)
- **Despliegue**: Docker, contenedor único, el backend sirve el build del frontend

## Node 22, no más nuevo

El `Dockerfile` fija `node:22-alpine`. **Usa Node 22 en local también.**
`better-sqlite3` 11.x trae binarios precompilados para Node 22; con Node 26
intenta compilar desde fuente y falla en macOS 13 por cabeceras C++20 ausentes
(`fatal error: 'source_location' file not found`). El frontend sí funciona con
cualquier versión reciente.

## pnpm, nunca npm

El gestor de paquetes es **pnpm** (fijado en `packageManager` de cada
`package.json`). No ejecutes `npm install` ni `npx` en este repo: regeneran un
`package-lock.json` que está en `.gitignore` y dejan el árbol de dependencias
descuadrado respecto a `pnpm-lock.yaml`. El equivalente de `npx` es `pnpm exec`
(o `pnpm dlx` para un paquete que no está instalado).

`backend/` y `frontend/` son **dos proyectos pnpm independientes**, cada uno con
su `pnpm-lock.yaml`. No es un workspace: el Dockerfile los instala en etapas
separadas y unificarlos obligaría a rehacer el build.

**pnpm bloquea los scripts de instalación por defecto.** Las excepciones se
declaran en `pnpm-workspace.yaml` bajo `allowBuilds`, y hoy son exactamente dos:
`better-sqlite3` (backend, binario nativo) y `esbuild` (frontend, binario por
plataforma). Ese archivo hay que copiarlo al contenedor: sin él la instalación
en Docker sale a medias sin fallar de forma visible. Si al añadir una
dependencia aparece `ERR_PNPM_IGNORED_BUILDS`, decide caso por caso — no lo
apruebes en automático, es la defensa contra un paquete que ejecute código al
instalarse.

## Comandos

```bash
# Backend (puerto 4000). La DB se siembra sola al arrancar si no existe.
cd backend && pnpm install && pnpm start
cd backend && pnpm run seed          # recrear la DB desde backend/data/*.json

# Regenerar el dataset desde PokeAPI (no se ejecuta en el arranque ni en el
# build: los JSON van versionados para que la PWA siga siendo offline-first).
cd backend && node tools/fetch-dataset.js

# Frontend (puerto 5173, proxy de /api a localhost:4000)
cd frontend && pnpm install && pnpm run dev
```

`backend` no tiene script `dev` — es `pnpm start`.

## Verificación antes de dar nada por cerrado

Siempre, sin excepciones:

```bash
cd frontend && pnpm exec tsc --noEmit && pnpm run build
cd backend  && node --check <cada archivo tocado> && node tests/*.smoke.js
```

Y comprobar la **paridad exacta de claves entre `es.json` y `en.json`**.

Ninguna prueba necesita servidor ni SQLite: simulan `db`, `req` y `res`.

- `overrides.smoke.js` — overrides de sesión, middleware y tabla de tipos.
- `history.smoke.js` — historial (ventana de 5 minutos y poda) y ajustes.
- `champions.smoke.js` — reglas de Champions (sobre todo que `null` y `[]` no se
  confundan) y multiplicadores propios.
- `championsMode.smoke.js` — el middleware del modo: filtrado, 404 en ficha no
  permitida y exclusividad con las sesiones.

Ejecuta la que corresponda a lo que toques.

Verificación interna, no le pidas al usuario que pruebe por ti lo que puedes
comprobar tú.

## Arquitectura

```
backend/
  data/        JSON semilla — la fuente de verdad del dataset
  db/          schema.sql, seed.js, populate.js, migrate.js, paths.js
  lib/         effectiveness.js, catalog.js, overrides.js, typechart.js,
               dataset.js, importValidator.js, pin.js, pinThrottle.js,
               championsFilter.js
  middleware/  sessionOverrides.js, championsMode.js
  routes/      types, pokemon, moves, abilities, items, search, sessions,
               chart, export, import, profiles, favorites, history, settings,
               champions
  tests/       overrides.smoke.js, history.smoke.js, champions.smoke.js,
               championsMode.smoke.js
frontend/src/
  components/  + components/forms/ para los editores
  pages/       una por ruta, registrada en App.tsx
  hooks/       useSessionOverride.ts
  lib/         api, apiSession, session, profile, favorites, history, settings,
               champions, theme, team, damage, recommendation, coverage
  i18n/        es.json, en.json, index.tsx
```

- **Cada ruta del backend es un módulo que exporta `(db) => router`** y se monta en `server.js`.
- **Componentes** reutilizables en `src/components/`; **páginas** con ruta propia en `src/pages/` + registrar la ruta en `src/App.tsx`.

### El volumen de Docker va en `/data`, nunca en `backend/db/`

`backend/db/` es **código** (`schema.sql`, `seed.js`, `populate.js`,
`migrate.js`, `paths.js`). La base de datos vive donde diga `PAMUDEX_DB_DIR`:
sin la variable, `backend/db/pamudex.sqlite` como siempre en local; en Docker,
`/data`.

Montar el volumen sobre `backend/db/` rompe las actualizaciones de forma
silenciosa: Docker copia el contenido de la imagen a un volumen **solo si está
vacío**, así que el volumen se queda con una copia congelada del código y a
partir de ahí la imagen nueva ya no llega. Un archivo nuevo (como `migrate.js`)
tumba el contenedor al arrancar. Estuvo así desde la Fase 1 y se corrigió en la 5.2.

Las columnas nuevas se añaden en `db/migrate.js`, que corre en cada arranque y
es **idempotente y solo aditivo**: `schema.sql` únicamente se ejecuta al sembrar
desde cero, y un despliegue en marcha no puede perder sus sesiones.

### Sesiones y overrides (Fase 3) — leer antes de tocar datos

Una sesión es un ROM Hack. Sus cambios viven en `sessions.data_json` como
overrides sobre el dato global; lo que no aparece conserva el valor original.

`backend/middleware/sessionOverrides.js` se monta con
`app.use("/api", sessionOverrides(db))` **antes** de las rutas de datos:
intercepta `res.json` y mezcla los overrides encima. **Ninguna ruta de datos
conoce las sesiones — no las modifiques para añadir soporte de `?session=`, ya
lo tienen.** Sin `?session=` el middleware hace `next()` y la API responde
exactamente igual que en la Fase 1.

`frontend/src/lib/api.ts` añade `?session=` solo cuando hay sesión activa, así
que cualquier página que use `api.*` respeta la sesión sin hacer nada.

**Un override sustituye el campo entero, así que debe guardarse con la misma
forma que devuelve la API.** Es el error que ya se cometió una vez: los
formularios guardaban `abilities` como array de cadenas cuando
`/api/pokemon/:id` las devuelve como array de objetos.

### Perfiles: dónde va cada preferencia (Fase 5)

- **Idioma y tema son columnas de `profiles`** (`language`, `theme`), no filas de
  `settings`. El perfil activo se cachea entero en `localStorage`, así que
  ambos se aplican en el primer render y sin conexión. No los dupliques.
- **El tema de la sesión de ROM Hack pisa al del perfil** mientras esa sesión
  esté activa; si la sesión no define tema, se cae al del perfil. Lo resuelve
  `useAppTheme()` en `App.tsx`.
- **`settings` es para lo que no merece columna**, con lista blanca de claves en
  `routes/settings.js` (`active_session`, `history_enabled`, `champions_rules`).
  Añadir una preferencia es añadirla ahí y en `ProfileSettings` de `apiSession.ts`.
- **`history` no lleva índice único** (a diferencia de `favorites`): es una
  bitácora. La regla de «no dos veces en 5 minutos» la aplica la ruta, y el
  historial se poda a las 300 visitas más recientes por perfil.
- La sesión de ROM Hack activa **se recuerda por perfil**
  (`settings.active_session`); `localStorage` sigue siendo la fuente de verdad
  inmediata porque `lib/api.ts` la lee de forma síncrona en cada petición.

## Convenciones obligatorias

### Paleta OLED, nunca negro puro

Base `#0A1425`, panel `#132238`, hover `#1C3350`, texto `#F5F7FA`, secundario
`#A9BDD2`. En Tailwind: `bg-base`, `bg-panel`, `bg-hover`, `text-ink`,
`text-ink-soft`. Los colores son `var(--color-*)` (`src/theme-vars.css`) para
que el tema por sesión pueda pisarlos — **no metas hex fijos en
`tailwind.config.js`**. El negro puro está prohibido: provoca estelas al hacer
scroll en pantallas OLED.

Tarjetas: `rounded-xl2 shadow-card bg-panel` + `animate-fadein`.

### i18n — los JSON son PLANOS

Nunca texto suelto en JSX. Añade la clave a `es.json` **Y** `en.json` y usa
`useI18n().t("clave")`. Parámetros: `t("clave", { name: "X" })` sustituye
`{{name}}`.

```json
"editor.fields.dex": "Nº de Pokédex"      ✅
"editor": { "fields": { "dex": "..." } }  ❌ la app pinta la clave cruda
```

`i18n/index.tsx` hace `dict[key]` directo y **no recorre objetos anidados**. Si
te entregan claves anidadas, aplánalas antes de pegarlas. Los dos archivos deben
tener exactamente el mismo juego de claves.

### Valores canónicos del dataset

`lib/damage.ts` y `types.ts` comparan contra ellos:

- Categoría de movimiento: **`fisico` | `especial` | `estado`** (español, sin tilde). Nunca `physical`/`special`/`status`.
- IDs de tipo (minúscula, sin tilde): `normal, fuego, agua, electrico, planta, hielo, lucha, veneno, tierra, volador, psiquico, bicho, roca, fantasma, dragon, siniestro, acero, hada`
- Multiplicadores: `4, 2, 1, 0.5, 0.25, 0` con claves `hiper_eficaz`, `super_eficaz`, `normal`, `poco_eficaz`, `muy_poco_eficaz`, `sin_efecto`.

### Móvil primero

De 4" a escritorio, incluidas Steam Deck, ROG Ally y AYN Thor.

### Antes de inventar tablas

`champions_rules` ya existe en `backend/db/schema.sql` sin lógica todavía.
Reutilízala. `users` existe y sigue vacía a propósito: se reserva para un login
real, y el PIN de perfil no va ahí.

### Una entidad nueva del dataset no se incorpora resembrando

`pnpm run seed` **borra la base entera**: perfiles, sesiones, favoritos,
historial y ajustes. Los datos nuevos entran por `db/migrate.js`, condicionados a
que la tabla esté vacía. Así se sembraron los objetos en la 6.0, y así hay que
hacerlo con lo que venga.

## Cómo se organiza el trabajo

`docs/ROADMAP.md` divide el proyecto en fases; cada fase se parte en tareas del
tamaño de una conversación, ya redactadas en `docs/tasks/faseN/`. Ese `.md` es la
especificación de la tarea. `docs/Fases/` guarda los entregables originales tal
cual llegaron, para poder auditar el repo contra ellos.

Al cerrar una fase, actualiza `docs/ROADMAP.md`, `docs/tasks/README.md`,
`README.md` y el **estado y las convenciones** de `docs/tasks/_CONTEXTO_BASE.md`.
Ese último es el que se pega en cada encargo futuro: si se queda obsoleto, la
siguiente tarea parte de información falsa.

Estado: **Fases 1-5 completas.** La 5 cerró con perfiles (`/perfiles`), PIN,
favoritos (`/favoritos`), historial (`/historial`) y ajustes (`/ajustes`).

**Fase 6 completa** (Pokémon Champions): objetos en el dataset (**6.0**), base de
reglas en `/champions/reglas` (**6.1**), multiplicadores propios (**6.2**) y el
modo en marcha en `/champions` (**6.3**). Siguiente: **Fase 7, multi-generación**.

### El modo Champions (Fase 6)

`?champions=<id>` lo aplica `middleware/championsMode.js`, montado **antes** que
`sessionOverrides`: filtra listados y `/search`, responde 404 en una ficha no
permitida y remapea los multiplicadores. **Ninguna ruta de datos conoce el
modo.** Va primero porque si llegan los dos parámetros descarta `?session=`:
Champions y las sesiones de ROM Hack son **excluyentes**.

En el frontend es `lib/champions.ts` (estado de módulo + eventos, como
`lib/session.ts`, **no** un context: `lib/api.ts` lo lee de forma síncrona).
Entrar pausa la sesión y salir la devuelve; esos cambios van con
`setActiveSessionId(id, silent)` para que no se guarden como preferencia del
perfil.

En las reglas de Champions, **`null` no es `[]`**: columna a NULL es «sin
restricción» y `[]` es «nada permitido». Un conjunto nuevo permite todo el
catálogo, si no habría que marcar 1025 casillas antes de que sirviera de algo.

### Efectividad: las claves son canónicas, los valores no

`lib/effectiveness.js` es una factoría `createEffectiveness(db, multipliers)`.
El producto de la tabla de tipos decide la **categoría** (`hiper_eficaz`,
`super_eficaz`, `normal`, `poco_eficaz`, `muy_poco_eficaz`, `sin_efecto`) y el
conjunto de reglas de Champions decide **qué número se enseña** en ella. No lo
inviertas: agrupar por número —como se hacía antes de la 6.2— hace que poner
«hiper eficaz» a x3 caiga en el cubo de x2.

`EffectivenessPanel.tsx` indexa etiqueta y color **por `key`**, nunca por el
multiplicador, y filtra el grupo neutro por `key !== "normal"`.

Las lecturas del catálogo (listados y fichas) están en `lib/catalog.js`, no
dentro de cada ruta: las comparten el modo estándar y Champions. Las decisiones de la fase están tomadas en
`docs/tasks/fase6/00-preparacion.md` — la principal, que el filtro de Champions
llega por **middleware con `?champions=<id>`**, igual que los overrides de sesión,
para no duplicar rutas ni páginas.

## Cómo trabaja el usuario

- Trabaja sobre el repo con git desde VSCode. Puedes modificar archivos
  directamente, pero **dile qué has tocado y por qué antes de que él haga commit**.
- **Explica cualquier decisión de arquitectura con implicaciones no obvias antes
  de aplicarla**, no la des por sentada. El middleware de overrides de la Fase 3
  es el ejemplo del tipo de decisión que hay que razonar primero.
- Escribe en español, igual que el código, los comentarios y la documentación.
