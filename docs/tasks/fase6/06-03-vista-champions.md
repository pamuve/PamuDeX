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
- [ ] Buscar un Pokémon no permitido en modo Champions no lo encuentra.
- [ ] Se ve siempre y sin ambigüedad en qué modo estás.
- [ ] Las páginas de ficha se reutilizan (no hay copias duplicadas del código).
- [ ] `npm run build` sin errores.

## Fuera de alcance
Comparador de equipos limitado a Champions (opcional, apuntar como mejora futura).
