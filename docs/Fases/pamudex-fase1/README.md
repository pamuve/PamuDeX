# PamuDeX

PWA autoalojada y offline-first para consultar tipos, Pokémon, movimientos y habilidades, con arquitectura preparada para comparador de equipos, sesiones de ROM Hack, editor visual, perfiles multiusuario y modo Pokémon Champions.

> Estado actual: **Fase 1 completa y verificada** (núcleo de datos + consulta + PWA offline + Docker). Ver [`docs/ROADMAP.md`](docs/ROADMAP.md) para las fases siguientes.

## Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS + `vite-plugin-pwa`
- **Backend**: Node.js + Express + SQLite (`better-sqlite3`)
- **Despliegue**: Docker (contenedor único) / Docker Compose

## Estructura del repositorio

```
pamudex/
├── backend/
│   ├── data/              # JSON semilla: types, type_chart, pokemon, moves, abilities
│   ├── db/
│   │   ├── schema.sql     # esquema SQLite completo (núcleo + tablas Fase 2+)
│   │   └── seed.js        # recrea la DB desde los JSON de /data
│   ├── lib/
│   │   └── effectiveness.js   # motor de cálculo de tipos (x4/x2/x1/x0.5/x0.25/x0)
│   ├── routes/             # types.js, pokemon.js, moves.js, abilities.js, search.js
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/icons/       # iconos PWA (192/512) — placeholder, sustituir por arte oficial
│   ├── src/
│   │   ├── components/     # TopBar, SearchBar, TypeBadge, EffectivenessPanel
│   │   ├── pages/          # Home, PokemonDetail, TypeDetail, MoveDetail, AbilityDetail
│   │   ├── i18n/            # es.json, en.json, index.tsx (contexto)
│   │   ├── lib/api.ts
│   │   ├── types.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts       # config PWA (manifest + service worker)
│   ├── tailwind.config.js   # paleta OLED exacta del proyecto
│   └── package.json
├── docs/
│   ├── ROADMAP.md           # todas las fases (2-9), divididas en tareas pequeñas
│   ├── AI_TASK_TEMPLATE.md  # plantilla para crear nuevos encargos de IA autocontenidos
│   └── tasks/
│       └── fase2/           # encargos ya redactados y listos para pegar en cualquier IA
├── Dockerfile
├── docker-compose.yml
└── .gitignore
```

## Cómo crear el repositorio en GitHub

```bash
# 1. Descomprime el zip que te ha dado Claude y entra en la carpeta
cd pamudex

# 2. Inicializa git
git init
git add .
git commit -m "Fase 1: núcleo de tipos, Pokémon, movimientos y habilidades (PWA offline)"

# 3. Crea el repo en GitHub (con GitHub CLI, o hazlo a mano en github.com y añade el remoto)
gh repo create pamudex --private --source=. --remote=origin
git push -u origin main
```

Si no usas `gh`, crea el repo vacío en GitHub y luego:
```bash
git remote add origin https://github.com/TU_USUARIO/pamudex.git
git branch -M main
git push -u origin main
```

## Desarrollo local (sin Docker)

```bash
# Terminal 1 — backend
cd backend
npm install
npm run seed      # crea backend/db/pamudex.sqlite desde los JSON de /data
npm start          # API en http://localhost:4000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxy automático a /api → :4000)
```

## Despliegue con Docker (recomendado para autoalojar)

```bash
docker compose up -d --build
```

Esto compila el frontend, arranca el backend en el puerto `4000`, sirve la PWA compilada desde el mismo contenedor y persiste la base de datos en un volumen (`pamudex_db`). La primera vez que arranca sin base de datos existente, se siembra automáticamente desde `backend/data/*.json`.

Accede desde el navegador del móvil/tablet/PC a `http://IP_DE_TU_SERVIDOR:4000` e instala la PWA ("Añadir a pantalla de inicio").

## Añadir más Pokémon/movimientos/habilidades ya mismo

Sin esperar a la Fase 4 (importación), puedes ampliar el dataset editando directamente los JSON de `backend/data/` siguiendo el mismo formato que las entradas existentes, y volviendo a ejecutar `npm run seed`. El esquema y las rutas ya soportan cualquier cantidad de entradas.

## Roadmap

Todo el trabajo pendiente está dividido en fases y tareas pequeñas, pensadas para cerrarse una por una en una sola conversación con Claude (o cualquier otra IA), incluso en planes gratuitos con límite de mensajes/contexto. Ver [`docs/ROADMAP.md`](docs/ROADMAP.md).

Para pedirle a una IA (con o sin memoria de este proyecto) que construya la siguiente pieza, usa directamente el archivo autocontenido correspondiente en `docs/tasks/`, o genera uno nuevo con la plantilla de [`docs/AI_TASK_TEMPLATE.md`](docs/AI_TASK_TEMPLATE.md).
