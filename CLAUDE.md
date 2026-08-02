# CLAUDE.md

Guía para trabajar en PamuDeX. Lee también `docs/tasks/_CONTEXTO_BASE.md`: es la
especificación que se pega en cada encargo de fase y manda sobre este archivo si
alguna vez se contradicen.

## Qué es

PWA autoalojada y **offline-first** tipo Pokédex para ROM Hacks de Pokémon
(Radical Red, Elite Redux…): tipos, Pokémon, movimientos, habilidades,
comparador de equipos, sesiones de ROM Hack con editor visual, y más adelante
perfiles multiusuario y modo Pokémon Champions.

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + `vite-plugin-pwa` + `react-router-dom` + `lucide-react`
- **Backend**: Node.js + Express + SQLite (`better-sqlite3`)
- **Despliegue**: Docker, contenedor único, el backend sirve el build del frontend

## Node 22, no más nuevo

El `Dockerfile` fija `node:22-alpine`. **Usa Node 22 en local también.**
`better-sqlite3` 11.x trae binarios precompilados para Node 22; con Node 26
intenta compilar desde fuente y falla en macOS 13 por cabeceras C++20 ausentes
(`fatal error: 'source_location' file not found`). El frontend sí funciona con
cualquier versión reciente.

## Comandos

```bash
# Backend (puerto 4000). La DB se siembra sola al arrancar si no existe.
cd backend && npm install && npm start
cd backend && npm run seed          # recrear la DB desde backend/data/*.json

# Regenerar el dataset desde PokeAPI (no se ejecuta en el arranque ni en el
# build: los JSON van versionados para que la PWA siga siendo offline-first).
cd backend && node tools/fetch-dataset.js

# Frontend (puerto 5173, proxy de /api a localhost:4000)
cd frontend && npm install && npm run dev
```

`backend` no tiene script `dev` — es `npm start`.

## Verificación antes de dar nada por cerrado

Siempre, sin excepciones:

```bash
cd frontend && npx tsc --noEmit && npm run build
cd backend  && node --check <cada archivo tocado> && node tests/overrides.smoke.js
```

Y comprobar la **paridad exacta de claves entre `es.json` y `en.json`**.

`tests/overrides.smoke.js` no necesita servidor ni SQLite: simula `db`, `req` y
`res`. Ejecútalo siempre que toques overrides, el middleware o la tabla de tipos.

Verificación interna, no le pidas al usuario que pruebe por ti lo que puedes
comprobar tú.

## Arquitectura

```
backend/
  data/        JSON semilla — la fuente de verdad del dataset
  db/          schema.sql, seed.js
  lib/         effectiveness.js, overrides.js, typechart.js
  middleware/  sessionOverrides.js
  routes/      types, pokemon, moves, abilities, search, sessions, chart
  tests/       overrides.smoke.js
frontend/src/
  components/  + components/forms/ para los editores
  pages/       una por ruta, registrada en App.tsx
  hooks/       useSessionOverride.ts
  lib/         api, apiSession, session, theme, team, damage, recommendation, coverage
  i18n/        es.json, en.json, index.tsx
```

- **Cada ruta del backend es un módulo que exporta `(db) => router`** y se monta en `server.js`.
- **Componentes** reutilizables en `src/components/`; **páginas** con ruta propia en `src/pages/` + registrar la ruta en `src/App.tsx`.

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

`items`, `users`, `profiles`, `settings`, `history`, `champions_rules` ya existen
en `backend/db/schema.sql` sin lógica todavía. Reutilízalas.

## Cómo se organiza el trabajo

`docs/ROADMAP.md` divide el proyecto en fases; cada fase se parte en tareas del
tamaño de una conversación, ya redactadas en `docs/tasks/faseN/`. Ese `.md` es la
especificación de la tarea. `docs/Fases/` guarda los entregables originales tal
cual llegaron, para poder auditar el repo contra ellos.

Al cerrar una fase, actualiza `docs/ROADMAP.md`, `docs/tasks/README.md`,
`README.md` y el **estado y las convenciones** de `docs/tasks/_CONTEXTO_BASE.md`.
Ese último es el que se pega en cada encargo futuro: si se queda obsoleto, la
siguiente tarea parte de información falsa.

Estado: Fases 1-3 completas. Siguiente: **Fase 4 — Importación / Exportación**.

## Cómo trabaja el usuario

- Trabaja sobre el repo con git desde VSCode. Puedes modificar archivos
  directamente, pero **dile qué has tocado y por qué antes de que él haga commit**.
- **Explica cualquier decisión de arquitectura con implicaciones no obvias antes
  de aplicarla**, no la des por sentada. El middleware de overrides de la Fase 3
  es el ejemplo del tipo de decisión que hay que razonar primero.
- Escribe en español, igual que el código, los comentarios y la documentación.
