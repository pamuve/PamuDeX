## 📌 Sobre el Proyecto

**PamuDeX** es una Progressive Web App (PWA) diseñada para cubrir las necesidades más avanzadas de los jugadores de Pokémon, especialmente aquellos inmersos en el mundo de los **ROM Hacks** (Radical Red, Elite Redux, Infinite Fusion, etc.). 

El objetivo es ofrecer una herramienta rápida, instalable y que funcione **100% sin conexión a internet** una vez sincronizada, permitiendo preparar combates, analizar coberturas de equipo y editar reglas o estadísticas personalizadas para adaptar la aplicación a cualquier juego modificado. Todo bajo un diseño *OLED Friendly* optimizado para consolas portátiles y dispositivos móviles.

## ✨ Características Principales

*   📱 **Responsive Universal & PWA:** Diseño fluido desde pantallas de 4" hasta monitores de PC. Totalmente instalable en iOS, Android, Steam Deck y Windows.
*   ⚡ **Offline-First:** Sincronización inteligente de base de datos con IndexedDB para una carga de datos garantizada en menos de 100ms, sin necesidad de conexión constante.
*   🔍 **Buscador Inmediato:** Autocompletado rápido para Pokémon, Tipos, Movimientos y Habilidades.
*   ⚔️ **Simulador Táctico:** Comparador avanzado de equipos que analiza la "Mejor Respuesta" basándose en coberturas, resistencias, inmunidades y movimientos esperados del rival.
*   🛠️ **Sesiones Personalizadas (ROM Hacks):** Base de datos adaptable para crear entornos de juego donde puedes modificar tipos, estadísticas o habilidades a través de un editor visual.
*   👥 **Sistema Multi-Perfil:** Soporte para múltiples usuarios locales con configuraciones, favoritos, historial y temas independientes.
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
│   ├── data/              # JSON semilla: types, type_chart, pokemon, moves, abilities
│   ├── db/
│   │   ├── schema.sql     # esquema SQLite completo (núcleo + tablas Fase 4+)
│   │   └── seed.js        # recrea la DB desde los JSON de /data
│   ├── lib/
│   │   ├── effectiveness.js   # motor de cálculo de tipos (x4/x2/x1/x0.5/x0.25/x0)
│   │   ├── overrides.js       # merge de los overrides de una sesión sobre el dato global
│   │   └── typechart.js       # tabla de tipos 18x18 + overrides de relaciones
│   ├── middleware/
│   │   └── sessionOverrides.js  # aplica ?session=<id> interceptando res.json
│   ├── routes/             # types, pokemon, moves, abilities, search, sessions, chart
│   ├── tests/
│   │   └── overrides.smoke.js   # prueba de humo sin servidor ni SQLite
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/icons/       # iconos PWA (192/512) — placeholder, sustituir por arte oficial
│   ├── src/
│   │   ├── components/     # TopBar, SearchBar, TypeBadge, EffectivenessPanel,
│   │   │   │               # TeamSlotCard, RivalSlotCard, RecommendationCard,
│   │   │   │               # CoverageMap, SessionRequired
│   │   │   └── forms/      # PokemonForm, TypeForm, MoveForm, AbilityForm,
│   │   │                   # RelationsMatrix, ThemeForm, EntityPicker, FormField
│   │   ├── pages/          # Home, PokemonDetail, TypeDetail, MoveDetail,
│   │   │                   # AbilityDetail, TeamBuilder, Sessions, Editor, EditorPokemon
│   │   ├── hooks/          # useSessionOverride.ts
│   │   ├── i18n/           # es.json, en.json, index.tsx (contexto)
│   │   ├── lib/            # api, apiSession, session, theme, team, damage,
│   │   │                   # recommendation, coverage
│   │   ├── theme-vars.css  # variables CSS de la paleta (las pisa el tema de sesión)
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
*La aplicación estará disponible en `http://localhost:3000`.*

### Desarrollo Local

Si deseas modificar el código fuente:

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
npm install
npm run dev
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

## ⚙️ Estado del proyecto

> Estado actual: **Fases 1, 2 y 3 completas y verificadas.**
>
> - **Fase 1** — núcleo de datos + consulta + PWA offline + Docker.
> - **Fase 2** — comparador de equipos táctico en `/equipo` (motor de daño, «mejor respuesta», mapa de cobertura).
> - **Fase 3** — sesiones de ROM Hack en `/sesiones` y editor visual en `/editor`, con overrides por sesión y tema propio.
>
> Siguiente: **Fase 4 — Importación / Exportación**. Ver [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Roadmap

Todo el trabajo pendiente está dividido en fases y tareas pequeñas, pensadas para cerrarse una por una. Ver [`docs/ROADMAP.md`](docs/ROADMAP.md).