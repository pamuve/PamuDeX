# Tarea 6.3 — Vista independiente de Pokémon Champions

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Una sección propia del modo, con la misma interfaz de consulta que la Pokédex general pero limitada al contenido permitido.

## Contexto extra
Depende de 6.1 y 6.2.
Objetivo de diseño: **reutilizar los componentes existentes** (`SearchBar`, `TypeBadge`, `EffectivenessPanel`, las páginas de ficha), no duplicarlos. La diferencia debe estar en el origen de datos, no en la UI.

## Entregable
1. `frontend/src/lib/championsContext.tsx` — contexto de React que indica si el modo Champions está activo y con qué conjunto de reglas; cuando lo está, `lib/api.ts` apunta a los endpoints de Champions.
2. `frontend/src/pages/ChampionsHome.tsx` en `/champions` — inicio del modo con su buscador, restringido al contenido legal.
3. Distintivo visual claro de que estás en modo Champions (por ejemplo, una franja o insignia permanente en `TopBar`), para no confundirlo con la Pokédex general.
4. Activar el modo desde el selector "Modo" que ya existe en `TopBar.tsx` (hoy es un menú de marcador de posición).
5. Salir del modo devuelve a la Pokédex estándar.

## Criterios de aceptación
- [x] Buscar un Pokémon no permitido en modo Champions no lo encuentra.
- [x] Se ve siempre y sin ambigüedad en qué modo estás.
- [x] Las páginas de ficha se reutilizan (no hay copias duplicadas del código).
- [x] `pnpm run build` sin errores.

## Fuera de alcance
Comparador de equipos limitado a Champions (opcional, apuntar como mejora futura).

## Cómo se resolvió

**El filtro llega por middleware, no por rutas propias.** `?champions=<id>` y
`backend/middleware/championsMode.js`, montado como `sessionOverrides`:
intercepta `res.json` y descarta lo que el conjunto de reglas no permite. Con
eso, **todas** las rutas de datos que ya existían quedan filtradas sin tocar ni
una línea de ellas, y las páginas de ficha son literalmente las mismas — que era
el criterio de «no duplicar la interfaz de consulta». `lib/api.ts` solo añade un
parámetro, igual que hace con las sesiones.

Los endpoints `/api/champions/:id/*` de la 6.1 siguen existiendo: los usa el
editor de reglas, que pregunta por un conjunto sin estar dentro del modo.

### Desvío del encargo: `lib/champions.ts`, no `championsContext.tsx`

El entregable 1 pedía un contexto de React. No puede serlo: `lib/api.ts` tiene
que saber si el modo está activo **de forma síncrona en cada petición**, y un
módulo que no es un componente no puede leer un context. Se implementó con el
patrón que ya usan `lib/session.ts`, `lib/profile.ts` y `lib/favorites.ts`
—estado de módulo en `localStorage` + eventos de `window`, con un hook encima—,
que además evita otro provider en `main.tsx`.

### Exclusividad con las sesiones de ROM Hack

Entrar en el modo **pausa** la sesión activa y recuerda cuál era; salir la
devuelve. La pausa NO borra la preferencia del perfil: `setActiveSessionId`
acepta ahora un `silent` que marca los cambios que no ha decidido el usuario
(restaurar la sesión de un perfil, pausarla al entrar en Champions), y
`lib/settings.ts` no los guarda. Sin eso, entrar en Champions habría dejado el
ROM Hack del perfil olvidado para siempre.

La exclusividad se garantiza en los dos lados: `lib/api.ts` nunca manda los dos
parámetros, y el middleware descarta `?session=` si llega junto a `?champions=`
(por eso se monta antes que `sessionOverrides`).

### Detalles que aparecieron al implementarlo

- **Las fichas se quedaban colgadas en «Cargando…»** al abrir una entidad no
  permitida: el backend responde 404 y las páginas hacían `.then()` sin
  `.catch()`. Se añadió `components/NotAllowed.tsx` y el manejo en las tres
  fichas que pueden dar 404 en este modo (Pokémon, movimiento, habilidad). Se
  llega ahí por un favorito, por el historial o escribiendo la URL.
- **Los multiplicadores no se recalculan, se remapean por clave.** Los grupos ya
  vienen con su `key` canónica de la 6.2, así que el middleware solo sustituye el
  número: ni lee la tabla de tipos ni rehace nada.
- **La `key` de `<Routes>` en `App.tsx`** pasa a cubrir los dos modos, para que
  cambiar de modo vuelva a pedir los datos.
- El conjunto activo se recuerda **por perfil** en `settings.champions_rules`,
  como se decidió en `00-preparacion.md`.

## Mejoras futuras anotadas

- El **comparador de equipos** (`/equipo`) no está limitado por el modo: sus
  datos vienen de `localStorage`, no de la API.
- Los objetos **no pasan por el middleware de overrides de sesión** ni por la
  exportación e importación de la Fase 4 (pendiente desde la 6.0).
