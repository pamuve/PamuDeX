# Roadmap de PamuDeX

Cada fase está partida en **tareas pequeñas** (una tarea = una conversación con una IA, incluso en plan gratuito). No dependas de que la IA recuerde nada de conversaciones anteriores: cada tarea con encargo ya redactado (carpeta `docs/tasks/`) lleva todo el contexto necesario pegado dentro del propio archivo.

Cómo usar esto: abre una conversación nueva → pega el contenido íntegro del `.md` de la tarea → adjunta (si el archivo lo pide) los ficheros fuente concretos que menciona → pide el código → copia los archivos generados a tu repo → `git commit`.

---

## ✅ Fase 1 — Núcleo (completada)

Tipos, Pokémon, movimientos, habilidades, buscador con autocompletado, PWA offline instalable, tema OLED, Docker de un solo contenedor, i18n ES/EN.

Dataset completo: **18 tipos, 1025 Pokémon, 901 movimientos y 312 habilidades**, en `backend/data/*.json` (más **2151 objetos** añadidos en la tarea 6.0). Se puede editar a mano o regenerar desde PokeAPI con `node backend/tools/fetch-dataset.js` (las entradas existentes se conservan; solo añade lo que falta). `makes_contact` queda a `null` en los movimientos importados porque PokeAPI no expone ese dato: la ficha muestra «—» en vez de inventar un Sí/No.

---

## ✅ Fase 2 — Comparador de equipos táctico (completada)

Encargos originales en `docs/tasks/fase2/` (ya implementados en el código).

| # | Tarea | Estado |
|---|-------|--------|
| 2.1 | Modelo de datos de equipo (hasta 6 Pokémon, objeto/habilidad/naturaleza/movimientos) + UI "Mi equipo" | ✅ `lib/team.ts`, `components/TeamSlotCard.tsx` |
| 2.2 | Panel "Equipo rival": habilidad/objeto/movimientos conocidos y sospechados | ✅ `components/RivalSlotCard.tsx` |
| 2.3 | Motor de estimación de daño (ataque/defensa, STAB, tipo) | ✅ `lib/damage.ts` |
| 2.4 | Analizador "Mejor respuesta" con motivos (✓) y peligros (✗) | ✅ `lib/recommendation.ts`, `components/RecommendationCard.tsx` |
| 2.5 | Mapa de cobertura del equipo | ✅ `lib/coverage.ts`, `components/CoverageMap.tsx` |

Todo integrado en la página `/equipo` (`pages/TeamBuilder.tsx`), accesible desde el icono de espadas en la barra superior. El equipo propio y el rival se guardan en `localStorage` (no hay backend de equipos todavía — eso llega con la Fase 5, perfiles de usuario).

---

## ✅ Fase 3 — Sesiones personalizadas + Editor visual (completada)

| # | Tarea | Estado |
|---|-------|--------|
| 3.1 | CRUD de sesiones | ✅ `backend/routes/sessions.js`, `pages/Sessions.tsx` |
| 3.2 | Mecanismo de overrides | ✅ `backend/lib/overrides.js`, `middleware/sessionOverrides.js` |
| 3.3 | Editor visual de Pokémon | ✅ `components/forms/PokemonForm.tsx`, `pages/EditorPokemon.tsx` |
| 3.4 | Editores de tipos, movimientos, habilidades y relaciones | ✅ `components/forms/*`, `pages/Editor.tsx` |
| 3.5 | Editor de colores/tema por sesión | ✅ `lib/theme.ts`, `components/forms/ThemeForm.tsx` |

El editor escribe overrides en `sessions.data_json`; el middleware `backend/middleware/sessionOverrides.js` los aplica cuando la petición lleva `?session=<id>`. `frontend/src/lib/api.ts` añade ese parámetro automáticamente cuando hay sesión activa, así que la Pokédex, los tipos y `/equipo` también ven los datos editados.

---

## ✅ Fase 4 — Importación / Exportación (completada)

| # | Tarea | Tamaño |
|---|-------|--------|
| 4.1 | Exportar sesión o dataset completo a JSON y CSV | ✅ `backend/routes/export.js`, `pages/ImportExport.tsx` (`/datos`) |
| 4.2 | Exportar a SQLite (descarga del `.sqlite` de una sesión) | ✅ `GET /api/export/sqlite`, `db/populate.js` |
| 4.3 | Importar JSON/CSV con validación y previsualización | ✅ `lib/importValidator.js`, `routes/import.js`, `components/ImportPanel.tsx` |
| 4.4 | Importar SQLite externo (fusionar o sustituir) | ✅ `POST /api/import/sqlite/*` |

---

## ✅ Fase 5 — Usuarios y perfiles (estilo Netflix) — completada

| # | Tarea | Tamaño | Estado |
|---|-------|--------|--------|
| 5.1 | Pantalla de selección de perfiles (avatar, nombre, color) + creación/edición | Media | ✅ `routes/profiles.js`, `pages/ProfileSelect.tsx` |
| 5.2 | Contraseña opcional por perfil (hash, verificación) | Pequeña | ✅ `lib/pin.js`, `lib/pinThrottle.js`, `components/PinDialog.tsx` |
| 5.3 | Favoritos por perfil (marcar Pokémon/movimientos/habilidades) | Pequeña | ✅ `routes/favorites.js`, `pages/Favorites.tsx` |
| 5.4 | Historial de consultas por perfil + ajustes (idioma/tema) persistentes por perfil | Pequeña | ✅ `routes/history.js`, `routes/settings.js`, `pages/History.tsx`, `pages/Settings.tsx` |

Perfiles en `/perfiles`, PIN de 4 dígitos (`profiles.pin_hash`, scrypt),
favoritos en `/favoritos`, historial en `/historial` y ajustes en `/ajustes`.

Las tres decisiones que quedaban abiertas antes de la 5.4 se resolvieron así, y
están explicadas en `docs/tasks/_CONTEXTO_BASE.md`:

- **Idioma en `profiles.language`**, no en `settings`: viaja con el perfil ya
  cacheado, así que se aplica en el primer render y sin conexión.
- **Tema: la sesión pisa al perfil.** El perfil elige una paleta del catálogo
  cerrado de `lib/theme.ts`; el tema libre de un ROM Hack manda mientras esa
  sesión esté activa.
- **Deduplicación del historial en la ruta** (5 minutos por entidad y perfil),
  porque `history` es una bitácora y no puede llevar índice único.

De propina, la sesión de ROM Hack activa dejó de ser global y pasó a recordarse
por perfil (`settings.active_session`).

---

## ✅ Fase 6 — Pokémon Champions — completada

Modo aparte en `/champions`, con su base de reglas en `/champions/reglas`. Los
tres encargos originales se escribieron antes de las fases 3, 4 y 5, así que la
fase empezó con una nota previa (`docs/tasks/fase6/00-preparacion.md`) y una
tarea añadida, la **6.0**: la tabla `items` estaba vacía y la 6.1 no tenía
objetos que filtrar.

Cuatro decisiones que conviene no reabrir sin motivo:

- **El filtro llega por middleware con `?champions=<id>`**, como los overrides de
  la Fase 3. Así las rutas de datos y las páginas de ficha que ya existían
  funcionan filtradas sin tocarlas, en vez de duplicar cada endpoint.
- **`null` no es `[]`**: en un conjunto de reglas, columna a NULL significa «sin
  restricción» y `[]` significa «nada permitido». Un conjunto nuevo permite todo
  el catálogo; si no, habría que marcar 1025 casillas antes de que sirviera.
- **Champions y las sesiones de ROM Hack son excluyentes.** Entrar pausa la
  sesión y salir la devuelve, sin perder la preferencia del perfil.
- **Los multiplicadores propios cambian los valores, nunca las claves.**
  `hiper_eficaz`, `super_eficaz`… son canónicas; un formato solo decide qué
  número se enseña en cada categoría.

| # | Tarea | Tamaño | Estado |
|---|-------|--------|--------|
| 6.0 | Objetos en el dataset (`items.json`, siembra por migración, `/api/items`) — añadida al preparar la fase | Pequeña | ✅ 2151 objetos en 54 categorías |
| 6.1 | Base de reglas independiente (`champions_rules`, ya en el esquema): Pokémon/objetos/movimientos/habilidades permitidos | Media | ✅ `/champions/reglas` |
| 6.2 | Multiplicador propio del modo ("Hiper eficaz" x4) integrado en `EffectivenessPanel` | Pequeña | ✅ `custom_multipliers_json` editable |
| 6.3 | Vista Champions separada de la Pokédex general (misma UI, dataset filtrado) | Media | ✅ `/champions`, middleware `?champions=` |

---

## ✅ Fase 7 — Multi-generación avanzada (completada)

| # | Tarea | Tamaño | Estado |
|---|-------|--------|--------|
| 7.1 | Selector de generación condicional: solo aparece si hay diferencias reales entre generaciones para esa entidad | Media | ✅ `entity_changes`, middleware `?gen=`, `GenerationSelector` |
| 7.2 | Vista "Todas las generaciones" con etiquetas de cambios históricos (tabla de tipos, movimientos, habilidades) | Media | ✅ `generational_changes` embebido, `ChangeTag` |
| 7.3 | Historial de cambios por Pokémon/movimiento/habilidad (qué cambió, en qué generación) | Media | ✅ 49 cambios sembrados, `ChangeHistory`, `/api/changes` |

Notas de la fase:

- **El valor histórico se reconstruye caminando hacia atrás** desde el dato de hoy: no hay ni va a haber una copia del catálogo por generación. Cada fila de `entity_changes` dice «en la generación N este campo pasó de X a Y», y el valor en una generación G es el `old_value` del cambio más antiguo posterior a G.
- **`?gen=` es un middleware**, como `?session=` y `?champions=`: ninguna ruta de datos conoce las generaciones. Se monta el último de los tres para transformar el primero, así los overrides de ROM Hack pisan encima. `?gen=` y `?session=` **se combinan**; Champions sigue siendo excluyente.
- **La ruta quedó en `/api/changes`, no en `/api/history`** como pedía el encargo: ese prefijo ya es el historial de consultas por perfil de la Tarea 5.4.
- **El conjunto de datos es inicial y corto a propósito** (49 cambios). Ampliarlo es incremental y está documentado en el README, con un validador (`pnpm run check:changes`) que comprueba que las cadenas empalman y que el último eslabón cuadra con el dataset.
- **Limitación conocida**: los tipos que aún no existían siguen apareciendo en las vistas antiguas (Acero, Siniestro y Hada salen en la tabla de la Gen 1). Ocultarlos necesita saber en qué generación nació cada tipo, dato que el dataset no guarda todavía.

---

## 🚧 Fase 8 — Accesibilidad, rendimiento y PWA avanzada (en curso)

| # | Tarea | Tamaño | Estado |
|---|-------|--------|--------|
| 8.1 | Modo alto contraste real + escalado de texto configurable | Pequeña | ✅ `lib/a11y.ts`, `.high-contrast`, cuatro niveles de texto |
| 8.2 | Navegación completa por teclado + auditoría de lector de pantalla (roles ARIA) | Media | ✅ `useMenu`, `useCombobox`, un solo `<main>` y enlace de salto |
| 8.3 | Notificaciones push opcionales + icono personalizado final (sustituir placeholder) | Pequeña | ✅ Icono propio, manifiesto completo y aviso de versión nueva |
| 8.4 | Medición y optimización: carga de datos locales <100ms, auditoría Lighthouse PWA | Pequeña | 🔜 |

Notas de la fase:

- **El alto contraste pisa al tema de sesión y al del perfil.** `lib/theme.ts` escribe las `--color-*` como estilo *inline* en `<html>`, así que `.high-contrast` las redeclara con `!important`, que es lo único que gana a un inline. La identidad visual de un ROM Hack no puede dejar la app ilegible.
- **Es el único sitio del proyecto donde se usa negro puro**, y solo porque el usuario lo activa a mano por accesibilidad. `panel` y `base` son el mismo negro: las tarjetas se distinguen por un `outline` blanco de 1px con `outline-offset: -1px`, que se dibuja dentro de la caja y no mueve ningún diseño.
- **Las fichas de color (`.color-chip`) cambian el fondo por un marco**: distintivos de tipo y avatares de perfil. Con el color del dataset detrás, los tipos apagados (siniestro 2.8:1, fantasma 3.1:1, lucha 3.2:1) no llegan a AAA y no hay forma de arreglarlo sin repintar el dataset.
- **La preferencia vive en `localStorage` y se copia al perfil**, como `active_session`: hay que aplicarla antes del primer render y también en `/perfiles`, donde aún no hay perfil que consultar.
- **Bug preexistente encontrado y corregido de camino**: el color `base` en `extend.colors` generaba un segundo `.text-base { color: var(--color-base) }` que pisaba al `.text-base` de tamaño de fuente de Tailwind, así que todo lo que llevara `text-base` se pintaba del color del fondo. Ahora `base` se declara solo en `backgroundColor` y `borderColor`.
- **Menú y combobox son dos patrones distintos, y por eso son dos hooks.** En un menú (`hooks/useMenu.ts`) el foco **viaja** a la opción; en un autocompletado (`hooks/useCombobox.ts`) el foco **se queda en el campo** —hay que poder seguir escribiendo— y la opción activa se señala con `aria-activedescendant`. Cada uno tiene dos o tres usos, así que unificarlos daría un componente que no cumple ninguno de los dos.
- **Un solo `<main>`, en `App.tsx` y no en cada página.** Solo seis de dieciséis páginas tenían el hito, así que el enlace «saltar al contenido» no habría tenido a dónde saltar en las otras diez. Centralizarlo garantiza uno por documento y que las páginas futuras lo hereden.
- **Al cambiar de ruta el foco vuelve al `<main>`.** En una SPA el navegador no recarga nada: sin esto el foco se queda en el enlace pulsado, el lector no anuncia la página nueva y el siguiente tabulador sigue por la barra.
- **El color del texto de los distintivos se calcula, no se fija** (`readableInk` en `lib/theme.ts`). Con `#0A1425` fijo, siniestro (2.79:1), fantasma (3.1), dragón (3.17), lucha (3.24) y veneno (3.28) no llegaban a AA; en blanco suben a 5.6-6.6. No hay un color que sirva para los dieciocho tipos, y además el usuario puede elegir colores libres en el editor de un ROM Hack.
- **`aria-modal` no atrapa el foco**: solo le dice al lector de pantalla que ignore el resto de la página. El diálogo del PIN necesitaba una trampa de verdad para que un tabulador no acabase escribiendo el PIN con el foco en la barra superior.
- **El icono es diseño propio, sin arte con copyright**: una «rueda de tipos» de seis arcos con la inicial en el centro, hecha en SVG (`public/icons/icon.svg`, el maestro del que salen los PNG). No es una Poké Ball ni un sprite: la app se distribuye y ese arte no es nuestro.
- **El `maskable` es un ARCHIVO distinto, no el mismo con otra etiqueta**: va a sangre y sin esquinas redondeadas, porque el sistema le aplica su propia forma y las esquinas transparentes saldrían en negro. La marca ocupa el 68.75 % del ancho, dentro del 80 % de zona segura.
- **El service worker pasó de `autoUpdate` a `prompt`.** Con `autoUpdate` se reemplazaba solo y recargaba sin avisar: no había ningún momento en el que pudiera existir un aviso de versión nueva —el caso de uso que pide la tarea— y una recarga sorpresa en mitad de una edición del editor de ROM Hacks es justo lo que no debe pasar.
- **El registro del service worker se hace a mano** (`lib/serviceWorker.ts`) en vez de con `virtual:pwa-register/react`: ese módulo importa `workbox-window`, que no está instalado, y usarlo obligaba a añadir una dependencia de tiempo de ejecución para unas comprobaciones periódicas que en una app autoalojada no aportan nada.
- **El permiso de notificaciones no se pide nunca solo**, únicamente desde el interruptor de `/ajustes`. Pedirlo al cargar gasta la única oportunidad —en Chrome un rechazo deja `denied` para siempre— sin que el usuario sepa para qué. Con el permiso denegado el interruptor NO se guarda como activado: sería mentir, porque no llegaría ningún aviso.
- **La franja en pantalla es el camino principal y la notificación es el extra**, para el único caso que la franja no cubre: que la pestaña esté en segundo plano. Así «con las notificaciones bloqueadas el resto funciona igual» se cumple por construcción.

---

## 🔜 Fase 9 — Ampliaciones futuras (abierta / opcional)

| # | Tarea | Tamaño |
|---|-------|--------|
| 9.1 | Calculadora de daño completa (con rangos, naturaleza, EVs/IVs, clima, terreno) | Grande → dividir en sub-tareas al llegar |
| 9.2 | Simulador de combate turno a turno | Grande → dividir en sub-tareas al llegar |
| 9.3 | IA que recomienda equipos según cobertura | Media-Grande |
| 9.4 | Sincronización opcional con Pokémon Showdown + import/export formato Showdown | Media |
| 9.5 | Editor de ROM Hacks avanzado + gestión de sprites personalizados (subida de imágenes propias) | Media |

> La Fase 9 es intencionadamente la más abierta: cuando llegues aquí, usa `docs/AI_TASK_TEMPLATE.md` para partir cada punto en tareas del tamaño de una sola conversación, igual que se hizo con las fases 2-8.

---

## Por qué está dividido así

- Cada tarea toca **un módulo concreto** (backend o frontend, rara vez ambos a fondo), así el contexto que hay que pegarle a la IA cabe en un mensaje.
- Las tareas dentro de una fase están ordenadas por dependencia: puedes cerrar 2.1 con una IA hoy y 2.2 con otra distinta mañana sin perder coherencia, porque el encargo de 2.2 ya incluye lo que 2.1 debió haber generado (interfaces/tipos).
- Ninguna tarea obliga a "recordar" el proyecto completo: el archivo de encargo trae el resumen, las convenciones (colores, i18n, estilo de carpetas) y los fragmentos de esquema/tipos relevantes.
