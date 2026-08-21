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
*   🕰️ **Multi-generación:** Las fichas que han cambiado entre generaciones lo dicen: un selector para ver los valores de cualquiera de las nueve, etiquetas junto a cada campo modificado y una línea temporal con todo el historial. Solo aparece donde hay cambios reales, así que no ensucia las fichas que nunca se han tocado.
*   🛡️ **Modo Pokémon Champions:** Un modo aparte con su propia base de reglas — qué Pokémon, movimientos, habilidades y objetos son legales — y multiplicadores de efectividad propios. Reutiliza toda la interfaz de consulta, con un distintivo permanente para no confundirlo con la Pokédex estándar.
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
│   │   ├── migrate.js     # migraciones en caliente, idempotentes y solo aditivas,
│   │   │                  # registradas en schema_migrations
│   │   ├── backup.js      # copias de seguridad en /data/backups (VACUUM INTO)
│   │   └── paths.js       # dónde vive el .sqlite (PAMUDEX_DB_DIR; /data en Docker)
│   ├── lib/
│   │   ├── effectiveness.js   # motor de cálculo de tipos (x4/x2/x1/x0.5/x0.25/x0)
│   │   ├── overrides.js       # merge de los overrides de una sesión sobre el dato global
│   │   ├── typechart.js       # tabla de tipos 18x18 + overrides de relaciones
│   │   ├── dataset.js         # dataset con overrides resueltos (export e import)
│   │   ├── importValidator.js # validación de JSON/CSV antes de aplicar
│   │   ├── pin.js, pinThrottle.js  # PIN de perfil (scrypt) y límite de intentos
│   │   ├── catalog.js         # lecturas del catálogo (listados y fichas)
│   │   └── championsFilter.js # reglas de Champions: qué contenido es legal
│   ├── middleware/
│   │   ├── sessionOverrides.js  # aplica ?session=<id> interceptando res.json
│   │   └── championsMode.js     # aplica ?champions=<id> igual (Fase 6)
│   ├── routes/             # types, pokemon, moves, abilities, items, search,
│   │                       # sessions, chart, export, import, profiles,
│   │                       # favorites, history, settings, champions, version
│   ├── tools/              # fetch-dataset, fetch-sprites, check-entity-changes,
│   │                       # backup.js y restore.js (copias de seguridad)
│   ├── tests/              # pruebas de humo sin servidor ni SQLite
│   │   ├── overrides.smoke.js
│   │   ├── history.smoke.js       # historial (ventana de 5 min) y ajustes
│   │   ├── champions.smoke.js     # reglas y multiplicadores de Champions
│   │   ├── championsMode.smoke.js # el middleware del modo
│   │   └── migrate.smoke.js       # registro, copia previa y aborto al fallar
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/icons/       # iconos PWA (192/512) — placeholder, sustituir por arte oficial
│   ├── src/
│   │   ├── components/     # TopBar, SearchBar, TypeBadge, EffectivenessPanel,
│   │   │   │               # TeamSlotCard, RivalSlotCard, RecommendationCard,
│   │   │   │               # CoverageMap, SessionRequired, ImportPanel,
│   │   │   │               # PinPad, PinDialog, FavoriteButton, NotAllowed
│   │   │   └── forms/      # PokemonForm, TypeForm, MoveForm, AbilityForm,
│   │   │                   # RelationsMatrix, ThemeForm, EntityPicker, FormField
│   │   ├── pages/          # Home, PokemonDetail, TypeDetail, MoveDetail,
│   │   │                   # AbilityDetail, TeamBuilder, Sessions, Editor,
│   │   │                   # EditorPokemon, ImportExport, ProfileSelect,
│   │   │                   # Favorites, History, Settings,
│   │   │                   # ChampionsHome, ChampionsRules
│   │   ├── hooks/          # useSessionOverride.ts
│   │   ├── i18n/           # es.json, en.json, index.tsx (contexto)
│   │   ├── lib/            # api, apiSession, session, profile, favorites,
│   │   │                   # history, settings, champions, theme, team,
│   │   │                   # damage, recommendation, coverage
│   │   ├── theme-vars.css  # variables CSS de la paleta (las pisan el tema de
│   │   │                   # sesión y, por debajo, el del perfil)
│   │   ├── types.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tools/
│   │   └── check-i18n.mjs   # paridad de claves es/en, planas y sin repetir
│   ├── vite.config.ts       # config PWA (manifest + service worker)
│   ├── tailwind.config.js   # paleta OLED enlazada a var(--color-*)
│   └── package.json
├── deploy/
│   └── portainer-stack.yml  # stack del homelab: consume la imagen de ghcr.io
├── .github/workflows/
│   ├── verificacion.yml     # tipos, build, pruebas de humo y paridad i18n
│   └── publicar-imagen.yml  # construye y publica en GHCR si la verificación pasa
├── docs/
│   ├── ROADMAP.md           # todas las fases (2-9), divididas en tareas pequeñas
│   ├── DESPLIEGUE.md        # Portainer, actualizaciones, copias y restauración
│   ├── AI_TASK_TEMPLATE.md  # plantilla para crear nuevos encargos de IA autocontenidos
│   ├── Fases/               # entregables originales de cada fase, tal cual se recibieron
│   └── tasks/
│       ├── _CONTEXTO_BASE.md   # se pega SIEMPRE antes del encargo de la tarea
│       └── fase2/ … fase9/     # encargos redactados, listos para pegar en cualquier IA
├── Dockerfile
├── docker-compose.yml       # despliegue LOCAL: construye la imagen desde el repo
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

### En un homelab, con Portainer

Ese `docker-compose.yml` **construye** la imagen, que es lo que quieres en local
mientras tocas el código. Para el servidor está `deploy/portainer-stack.yml`,
que consume la imagen ya construida por GitHub Actions:

**Stacks → Add stack → Repository**, apuntando a este repositorio con
*Compose path* `deploy/portainer-stack.yml` y **Automatic updates → Polling**.
A partir de ahí, actualizar es `git push`: Actions verifica el código, publica
`ghcr.io/pamuve/pamudex:latest` y Portainer la recoge en la siguiente ronda.

**La guía completa está en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)**: primer
despliegue, copias de seguridad, restauración y cómo volver a una versión
anterior.

### Actualizaciones sin perder datos

El contenedor se sustituye entero en cada actualización; el volumen `/data` no.
Antes de tocar el esquema, el arranque hace lo siguiente:

1. **Copia la base de datos** en `/data/backups` (solo si de verdad hay
   migraciones que aplicar; se conservan las 5 últimas).
2. **Aplica las migraciones pendientes**, cada una en su transacción, y las
   anota en la tabla `schema_migrations`.
3. **Si alguna falla, restaura la copia y el contenedor no arranca.** La base
   queda exactamente como estaba: todo o nada.

Qué versión hay desplegada, qué migraciones tiene la base y cuántos perfiles y
sesiones sobrevivieron, en **`/api/version`**.

```bash
# Copia de seguridad manual (no hace falta parar el contenedor)
docker exec pamudex node tools/backup.js

# Ver las copias que hay
docker exec pamudex node tools/backup.js --list
```

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

**Los sprites hay que bajarlos una vez.** Son 1025 PNG (~1,1 MB) que **no están
en el repo**: los descarga el build de Docker, así que para trabajar en local
hace falta ejecutarlo a mano o las fichas y las listas saldrán con la inicial
del Pokémon en vez del sprite.

```bash
cd backend
node tools/fetch-sprites.js
```

### Historial de cambios entre generaciones

El historial vive en [`backend/data/entity_changes.json`](backend/data/entity_changes.json).
El conjunto que trae el repo es **inicial y deliberadamente corto** (los cambios
más conocidos: la llegada del tipo Hada, Acero perdiendo resistencias, la
división físico/especial de la Gen 4 y algunos ajustes de potencia). Ampliarlo es
un trabajo incremental y el formato está pensado para eso.

**Cada entrada es un cambio de UN campo en UNA generación:**

```json
{ "entity_type": "move", "ref": "Lanzallamas", "generation": 6,
  "field": "power", "old_value": 95, "new_value": 90,
  "note": "Rebaja general de potencia de la Gen 6." }
```

*   **`generation` es la de ENTRADA EN VIGOR.** Desde ella el campo vale
    `new_value`; antes valía `old_value`. La división físico/especial es «Gen 4»,
    así que en la Gen 4 los movimientos ya están divididos.
*   **`ref` es la clave natural, no el id interno**: el nº de Pokédex en Pokémon,
    el `name_es` en movimientos y habilidades, el id (`"acero"`) en tipos. Los ids
    internos los reparte el AUTOINCREMENT al sembrar y regenerar el dataset puede
    moverlos.
*   **`field` es el nombre del campo tal y como lo devuelve la API** (`power`,
    `accuracy`, `category`, `types`, `effect_es`…). Admite un nivel de anidamiento
    con punto: `stats.atk`.
*   **Los cambios de la tabla de tipos se anotan en el DEFENSOR**, con
    `field: "relation:<atacante>"`. Que Acero dejara de resistir a Fantasma es
    `"ref": "acero", "field": "relation:fantasma", "old_value": 0.5, "new_value": 1`.
    La ficha del atacante lo enseña sola, no hay que duplicarlo.

**Las dos reglas que hay que respetar sí o sí.** El valor histórico se
reconstruye caminando hacia atrás desde el valor de HOY, así que:

1.  **Cadena**: si un campo cambió varias veces, el `new_value` de un cambio debe
    ser exactamente el `old_value` del siguiente.
2.  **Anclaje**: el `new_value` del cambio más reciente debe coincidir con lo que
    ese campo vale hoy en el dataset.

Si se rompe cualquiera de las dos, la ficha enseña valores que nunca existieron y
no falla nada de forma visible. Por eso hay un validador:

```bash
cd backend && pnpm run check:changes
```

Comprueba las dos reglas contra la base de datos real y avisa de las referencias
que no resuelven. Ejecútalo siempre después de tocar el archivo.

**Para que los cambios nuevos entren en una instalación que ya está en marcha**,
la siembra la hace `db/migrate.js` cuando la tabla está vacía. Si ya tenías
historial y quieres el conjunto ampliado, borra la tabla (`DELETE FROM
entity_changes`) y reinicia: **no ejecutes `pnpm run seed`**, que borra la base
entera con tus perfiles, sesiones, favoritos e historial de consultas.

> **Limitación conocida.** Los tipos que aún no existían siguen apareciendo en las
> vistas antiguas: en la Gen 1 la tabla de efectividad sigue listando Acero,
> Siniestro y Hada. Ocultarlos necesita saber en qué generación nació cada tipo,
> que es un dato que el dataset todavía no guarda.

## 🎨 Guía de Diseño (UI/UX)

La interfaz utiliza una paleta de colores pensada para dispositivos OLED para minimizar el consumo y el *black smearing*:
*   **Color Principal:** `#0A1425`
*   **Paneles y Tarjetas:** `#132238`
*   **Hover States:** `#1C3350`
*   **Texto Principal:** `#F5F7FA`
*   **Texto Secundario:** `#A9BDD2`

### Iconos de la aplicación

El icono es **diseño propio**: una «rueda de tipos» de seis arcos con la inicial
en el centro. No lleva arte de Pokémon con copyright, a propósito, porque la app
se distribuye.

El maestro es `frontend/public/icons/icon.svg`; `icon-maskable.svg` es la
variante a sangre para Android, que aplica su propia máscara y pintaría de negro
cualquier esquina transparente. Si tocas el diseño, regenera los cinco archivos
(hace falta `librsvg` e `ImageMagick`, solo para esto):

```bash
cd frontend/public/icons && rsvg-convert -w 192 -h 192 icon.svg -o icon-192.png && rsvg-convert -w 512 -h 512 icon.svg -o icon-512.png && rsvg-convert -w 512 -h 512 icon-maskable.svg -o icon-512-maskable.png && rsvg-convert -w 180 -h 180 icon-maskable.svg -o apple-touch-icon.png && for s in 16 32 48; do rsvg-convert -w $s -h $s icon.svg -o /tmp/pamudex-f$s.png; done && magick /tmp/pamudex-f16.png /tmp/pamudex-f32.png /tmp/pamudex-f48.png ../favicon.ico
```

### Datos sin conexión y rendimiento

El catálogo (tipos, Pokémon, movimientos, habilidades y las 18 fichas de tipo)
se guarda en **IndexedDB** conforme lo vas usando, y en `/ajustes` hay un botón
**«Descargar datos para uso offline»** con barra de progreso y la fecha de la
última descarga, para cuando sabes que vas a quedarte sin cobertura.

La lectura es **local primero**: si el dato está en el aparato se pinta al
momento y la red se consulta después, en segundo plano, solo para dejar la copia
al día. La interfaz nunca espera a la red teniendo copia local.

En `/ajustes` → **Modo de depuración** puedes ver cuánto tarda cada lectura en
tu propio aparato. Medido aquí, sobre el build servido por el contenedor:

| Medida | Resultado |
|---|---|
| Lecturas del catálogo desde IndexedDB | **media 1.1 ms · peor 1.8 ms** (objetivo <100 ms) |
| Navegación → catálogo pintado (primera carga) | **~94 ms** |
| TTFB / DOM interactivo / carga completa | 7.5 / 12.1 / 18.3 ms |
| CLS (desplazamiento de diseño) | **0** |
| JS / CSS del arranque | 416 KB / 28 KB sin comprimir (113 KB / 6 KB con gzip) |

**Qué NO se descarga**: las fichas de Pokémon, movimientos y habilidades son más
de 2200 y ocuparían decenas de megas, así que esas siguen dependiendo de haberlas
visitado (el Service Worker las guarda al pasar por ellas). Si abres una ficha
que no tienes guardada y estás sin conexión, la app lo dice claramente y te deja
reintentar, en vez de quedarse cargando para siempre.

> **Sobre la auditoría Lighthouse.** Los criterios de instalación que comprueba
> Lighthouse están verificados uno a uno (manifiesto con nombre, nombre corto,
> iconos de 192, 512 y *maskable*, `start_url`, `display: standalone`, service
> worker activo y contexto seguro), igual que los básicos de `html lang`,
> `viewport`, `theme-color` y descripción. Lo que **no** se ha podido ejecutar es
> Lighthouse en sí, porque necesita un Chrome instalado y el entorno donde se
> desarrolló esta fase no lo tiene; por el mismo motivo faltan FCP y LCP, que
> exigen una ventana pintando de verdad. Si lo pasas tú, `pnpm dlx lighthouse
> http://localhost:4000 --view` con la app en marcha.

### Actualizaciones y notificaciones

El service worker está en modo **`prompt`**: cuando reconstruyes la imagen, la
versión nueva no se aplica sola. La app enseña una franja «Hay una versión nueva
de PamuDeX lista» y espera a que el usuario pulse *Actualizar*, para no recargar
la página en mitad de una edición del editor de ROM Hacks.

Las notificaciones del sistema son **opcionales y están apagadas de fábrica**.
Solo sirven para ese mismo aviso cuando la app está en segundo plano, y el
permiso no se pide hasta que las activas en `/ajustes`. Si las tienes bloqueadas
en el navegador, la franja sigue funcionando igual: no se pierde nada.

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

> Estado actual: **Fases 1 a 7 completas y verificadas.**
>
> - **Fase 1** — núcleo de datos + consulta + PWA offline + Docker.
> - **Fase 2** — comparador de equipos táctico en `/equipo` (motor de daño, «mejor respuesta», mapa de cobertura).
> - **Fase 3** — sesiones de ROM Hack en `/sesiones` y editor visual en `/editor`, con overrides por sesión y tema propio.
> - **Fase 4** — importación y exportación en JSON, CSV y SQLite desde `/datos`, con previsualización antes de aplicar.
> - **Fase 5** — perfiles en `/perfiles` con PIN opcional, favoritos en `/favoritos`,
>   historial en `/historial` y ajustes en `/ajustes`. Cada perfil tiene su
>   idioma, su tema, su historial y su sesión de ROM Hack.
>
> - **Fase 6** — modo Pokémon Champions en `/champions`, con su base de reglas en
>   `/champions/reglas`: qué Pokémon, movimientos, habilidades y objetos son
>   legales, y multiplicadores de efectividad propios. Es un modo aparte: no toca
>   la Pokédex estándar y es excluyente con las sesiones de ROM Hack. Trajo además
>   los **2151 objetos** al dataset.
>
> - **Fase 7** — multi-generación. Las fichas de Pokémon, movimiento, habilidad y
>   tipo aceptan `?gen=<n>` y enseñan un selector **solo si esa entidad cambió de
>   verdad**; en la vista «Todas las generaciones» cada campo modificado lleva una
>   etiqueta con qué cambió y cuándo, y hay una línea temporal completa. El
>   historial se amplía editando un JSON (ver «Historial de cambios entre
>   generaciones»).
>
> - **Fase 8** (en curso) — accesibilidad, rendimiento y PWA avanzada. De momento,
>   **modo de alto contraste** y **escalado de texto** en cuatro niveles (90, 100,
>   115 y 130 %) desde `/ajustes`: se aplican al instante, sobreviven a recargar y
>   se recuerdan por perfil. El alto contraste manda sobre el tema del ROM Hack y
>   sobre el del perfil, y es el único sitio de la app donde se usa negro puro.
>   La app se maneja además **entera con el teclado**: enlace para saltar al
>   contenido, menús y autocompletados con flechas y `Escape`, nombre accesible
>   en todos los controles y aviso hablado cuando cambian las recomendaciones
>   del comparador. La PWA estrena **icono propio** (192, 512, *maskable*,
>   *apple-touch* y `favicon.ico`), manifiesto completo y aviso de **versión
>   nueva lista**, con notificaciones del sistema opcionales y apagadas de
>   fábrica. Y el catálogo vive en **IndexedDB**: se lee en **1-2 ms**, con
>   descarga explícita para uso sin conexión y un modo de depuración que enseña
>   los tiempos.
>
> **Fase 8 completa.** Siguiente: **Fase 9 — ampliaciones** (calculadora de daño,
> simulador de combate, recomendador de equipos…), que está abierta a propósito.
> Ver [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Roadmap

Todo el trabajo pendiente está dividido en fases y tareas pequeñas, pensadas para cerrarse una por una. Ver [`docs/ROADMAP.md`](docs/ROADMAP.md).