## 📌 Sobre el Proyecto

**PamuDeX** es una Progressive Web App (PWA) diseñada para cubrir las necesidades más avanzadas de los jugadores de Pokémon, especialmente aquellos inmersos en el mundo de los **ROM Hacks** (Radical Red, Elite Redux, Infinite Fusion, etc.). 

El objetivo es ofrecer una herramienta rápida, instalable y que funcione **100% sin conexión a internet** una vez sincronizada, permitiendo preparar combates, analizar coberturas de equipo y editar reglas o estadísticas personalizadas para adaptar la aplicación a cualquier juego modificado. Todo bajo un diseño *OLED Friendly* optimizado para consolas portátiles y dispositivos móviles.

## ✨ Características Principales

*   📱 **Responsive Universal & PWA:** Diseño fluido desde pantallas de 4" hasta monitores de PC. Totalmente instalable en iOS, Android, Steam Deck y Windows.
*   ⚡ **Offline-First:** Sincronización inteligente de base de datos con IndexedDB para una carga de datos garantizada en menos de 100ms, sin necesidad de conexión constante.
*   🔍 **Buscador Inmediato:** Autocompletado rápido para Pokémon, Tipos, Movimientos y Habilidades.
*   ⚔️ **Simulador Táctico:** Comparador avanzado de equipos que analiza la "Mejor Respuesta" basándose en coberturas, resistencias, inmunidades y movimientos esperados del rival.
*   🛠️ **Sesiones Personalizadas (ROM Hacks):** Base de datos adaptable para crear entornos de juego donde puedes modificar tipos, estadísticas o habilidades a través de un editor visual.
*   👥 **Sistema Multi-Perfil:** Soporte para múltiples usuarios locales con configuraciones, favoritos, historial y temas independientes, con PIN opcional por perfil (ver [Alcance de seguridad](#-alcance-de-seguridad)).
*   🐳 **Autoalojable:** Despliegue en un solo contenedor Docker con persistencia de datos mediante volúmenes, compatible con Docker Compose.

## 🏗️ Arquitectura y Tecnologías

**Frontend:**
*   React + TypeScript
*   Vite (Build tool)
*   TailwindCSS (Estilos y Tema OLED Friendly)
*   Framer Motion (Animaciones)
*   IndexedDB / Dexie.js (Persistencia offline y caché)

**Backend:**
*   Node.js + Express
*   SQLite (Base de datos principal)
*   API REST (Estructurada para futura migración a GraphQL)

**Despliegue:**
*   Docker & Docker Compose

## Estructura del repositorio

```
pamudex/
├── backend/
│   ├── data/              # JSON semilla: types, type_chart, pokemon, moves,
│   │                      # abilities, items
│   ├── db/
│   │   ├── schema.sql     # esquema SQLite completo (núcleo + tablas Fase 4+)
│   │   ├── seed.js        # recrea la DB desde los JSON de /data
│   │   ├── migrate.js     # migraciones en caliente, idempotentes y solo aditivas
│   │   └── paths.js       # dónde vive el .sqlite (PAMUDEX_DB_DIR; /data en Docker)
│   ├── lib/
│   │   ├── effectiveness.js   # motor de cálculo de tipos (x4/x2/x1/x0.5/x0.25/x0)
│   │   ├── overrides.js       # merge de los overrides de una sesión sobre el dato global
│   │   ├── typechart.js       # tabla de tipos 18x18 + overrides de relaciones
│   │   ├── dataset.js         # dataset con overrides resueltos (export e import)
│   │   ├── importValidator.js # validación de JSON/CSV antes de aplicar
│   │   └── pin.js, pinThrottle.js  # PIN de perfil (scrypt) y límite de intentos
│   ├── middleware/
│   │   └── sessionOverrides.js  # aplica ?session=<id> interceptando res.json
│   ├── routes/             # types, pokemon, moves, abilities, items, search,
│   │                       # sessions, chart, export, import, profiles,
│   │                       # favorites, history, settings
│   ├── tests/              # pruebas de humo sin servidor ni SQLite
│   │   ├── overrides.smoke.js
│   │   └── history.smoke.js     # historial (ventana de 5 min) y ajustes
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/icons/       # iconos PWA (192/512) — placeholder, sustituir por arte oficial
│   ├── src/
│   │   ├── components/     # TopBar, SearchBar, TypeBadge, EffectivenessPanel,
│   │   │   │               # TeamSlotCard, RivalSlotCard, RecommendationCard,
│   │   │   │               # CoverageMap, SessionRequired, ImportPanel,
│   │   │   │               # PinPad, PinDialog, FavoriteButton
│   │   │   └── forms/      # PokemonForm, TypeForm, MoveForm, AbilityForm,
│   │   │                   # RelationsMatrix, ThemeForm, EntityPicker, FormField
│   │   ├── pages/          # Home, PokemonDetail, TypeDetail, MoveDetail,
│   │   │                   # AbilityDetail, TeamBuilder, Sessions, Editor,
│   │   │                   # EditorPokemon, ImportExport, ProfileSelect,
│   │   │                   # Favorites, History, Settings
│   │   ├── hooks/          # useSessionOverride.ts
│   │   ├── i18n/           # es.json, en.json, index.tsx (contexto)
│   │   ├── lib/            # api, apiSession, session, profile, favorites,
│   │   │                   # history, settings, theme, team, damage,
│   │   │                   # recommendation, coverage
│   │   ├── theme-vars.css  # variables CSS de la paleta (las pisan el tema de
│   │   │                   # sesión y, por debajo, el del perfil)
│   │   ├── types.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts       # config PWA (manifest + service worker)
│   ├── tailwind.config.js   # paleta OLED enlazada a var(--color-*)
│   └── package.json
├── docs/
│   ├── ROADMAP.md           # todas las fases (2-9), divididas en tareas pequeñas
│   ├── AI_TASK_TEMPLATE.md  # plantilla para crear nuevos encargos de IA autocontenidos
│   ├── Fases/               # entregables originales de cada fase, tal cual se recibieron
│   └── tasks/
│       ├── _CONTEXTO_BASE.md   # se pega SIEMPRE antes del encargo de la tarea
│       └── fase2/ … fase9/     # encargos redactados, listos para pegar en cualquier IA
├── Dockerfile
├── docker-compose.yml
└── .gitignore
```

## 🚀 Instalación y Despliegue

La forma más rápida de levantar PamuDeX es mediante Docker.

### Requisitos Previos
*   Docker instalado y ejecutándose.
*   Docker Compose.

### Clonar y Levantar el Entorno

```bash
# 1. Clonar el repositorio
git clone https://github.com/pamuve/PamuDeX.git
cd PamuDeX

# 2. Levantar los contenedores
docker-compose up -d
```
*La aplicación estará disponible en `http://localhost:4000`.*

Los datos persisten en el volumen `pamudex_db`, montado en **`/data`**. La base
de datos se siembra sola en el primer arranque y las migraciones de esquema se
aplican en cada arranque, así que actualizar la imagen no pierde nada.

> **Si desplegaste PamuDeX antes de la Fase 5.2**, tu volumen estaba montado en
> `/app/backend/db`, que además de la base de datos contenía el código del
> esquema. Docker no refresca un volumen que ya tiene contenido, así que ese
> código quedó congelado en la versión del primer despliegue y el contenedor
> ya no arrancaría. Para mover tus datos al nuevo volumen:
>
> ```bash
> docker-compose down
> docker run --rm -v pamudex_pamudex_db:/viejo -v pamudex_datos:/nuevo alpine \
>   cp /viejo/pamudex.sqlite /nuevo/pamudex.sqlite
> ```
>
> Ajusta los nombres a los que devuelva `docker volume ls` y apunta el volumen
> `pamudex_db` de `docker-compose.yml` al nuevo. Se conservan perfiles, sesiones
> y personalizaciones.

### Desarrollo Local

Si deseas modificar el código fuente:

> El gestor de paquetes del proyecto es **pnpm** (`npm install -g pnpm`, o
> `corepack enable`). No uses `npm install`: el repo versiona `pnpm-lock.yaml`.

```bash
# Frontend (puerto 5173)
cd frontend
pnpm install
pnpm run dev

# Backend (puerto 4000)
cd backend
pnpm install
pnpm start
```

## 🎨 Guía de Diseño (UI/UX)

La interfaz utiliza una paleta de colores pensada para dispositivos OLED para minimizar el consumo y el *black smearing*:
*   **Color Principal:** `#0A1425`
*   **Paneles y Tarjetas:** `#132238`
*   **Hover States:** `#1C3350`
*   **Texto Principal:** `#F5F7FA`
*   **Texto Secundario:** `#A9BDD2`

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! La arquitectura modular está diseñada para escalar y admitir en el futuro calculadoras de daño completas e integraciones con Pokémon Showdown.

## ⚖️ Licencia y Aviso Legal

El código fuente de esta aplicación se distribuye bajo la licencia **MIT** (ver archivo `LICENSE`).

**Descargo de Responsabilidad (Disclaimer):**
PamuDeX es una aplicación creada por fans y con fines estrictamente educativos y tácticos. 
© 1995–2026 Nintendo/Creatures Inc./GAME FREAK inc. Pokémon, los nombres de los personajes, sprites y recursos visuales son marcas registradas de Nintendo. 
Este proyecto **NO** tiene afiliación, patrocinio ni está respaldado por Nintendo, Creatures Inc. o GAME FREAK. Todos los recursos visuales oficiales se utilizan bajo el principio de *Uso Justo (Fair Use)* y el proyecto no tiene fines comerciales.

## 🔒 Alcance de seguridad

El **PIN de perfil** es un bloqueo *entre convivientes*, al estilo del PIN de
perfil de Netflix. **No es autenticación** y PamuDeX no está pensada para
exponerse a internet.

Qué hace y qué no:

- El PIN **nunca se guarda ni viaja en claro**: se almacena como hash `scrypt`
  con sal aleatoria por perfil (`profiles.pin_hash`), y el hash no sale nunca de
  la API.
- El servidor **limita los intentos** con pausa creciente a partir del quinto
  fallo, que es la defensa real contra probar PINs a lo bruto.
- Pero **son 4 dígitos: 10.000 combinaciones**. Quien tenga acceso al archivo
  `pamudex.sqlite` puede agotarlas sin dificultad. El hash impide leer el PIN de
  un vistazo abriendo la base de datos; no protege frente a un atacante decidido.
- **No hay recuperación de PIN.** Si se olvida, la única salida es borrar el
  perfil, y eso se lleva sus sesiones de ROM Hack por delante.

Si algún día quieres exponer la app fuera de tu red, hace falta autenticación de
verdad a nivel de cuenta (`users.password_hash`, hoy sin usar), HTTPS y sesiones
con token. Nada de eso está implementado.

## ⚙️ Estado del proyecto

> Estado actual: **Fases 1 a 5 completas y verificadas.**
>
> - **Fase 1** — núcleo de datos + consulta + PWA offline + Docker.
> - **Fase 2** — comparador de equipos táctico en `/equipo` (motor de daño, «mejor respuesta», mapa de cobertura).
> - **Fase 3** — sesiones de ROM Hack en `/sesiones` y editor visual en `/editor`, con overrides por sesión y tema propio.
> - **Fase 4** — importación y exportación en JSON, CSV y SQLite desde `/datos`, con previsualización antes de aplicar.
> - **Fase 5** — perfiles en `/perfiles` con PIN opcional, favoritos en `/favoritos`,
>   historial en `/historial` y ajustes en `/ajustes`. Cada perfil tiene su
>   idioma, su tema, su historial y su sesión de ROM Hack.
>
> Siguiente: **Fase 6 — Pokémon Champions**, con nota previa en
> [`docs/tasks/fase6/00-preparacion.md`](docs/tasks/fase6/00-preparacion.md).
> Ver [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Roadmap

Todo el trabajo pendiente está dividido en fases y tareas pequeñas, pensadas para cerrarse una por una. Ver [`docs/ROADMAP.md`](docs/ROADMAP.md).