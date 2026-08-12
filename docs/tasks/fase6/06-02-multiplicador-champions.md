# Tarea 6.2 — Multiplicador propio "Hiper eficaz" (x4)

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Que el modo Champions pueda definir multiplicadores propios, empezando por "Hiper eficaz" x4 como categoría del modo.

## Contexto extra
Depende de 6.1 (`custom_multipliers_json`).
Hoy la etiqueta x4 ya existe en `backend/lib/effectiveness.js` y en `frontend/src/components/EffectivenessPanel.tsx` (constante `LABEL_KEY` / `ACCENT`), pero surge de multiplicar dos tipos, no de una regla configurable. Aquí se trata de que el modo pueda **redefinir** los valores.

## Entregable
1. `backend/lib/effectiveness.js` — aceptar una tabla de multiplicadores personalizada inyectada (por ejemplo `{ hiper_eficaz: 4, super_eficaz: 2, ... }`) en vez de usar siempre las constantes fijas.
2. Endpoints de Champions que devuelvan efectividad usando esos multiplicadores.
3. `EffectivenessPanel.tsx` — que las etiquetas y colores de acento salgan de los datos recibidos y no de constantes fijas, sin romper el comportamiento actual cuando no hay personalización.
4. UI en `/champions/reglas` para editar los multiplicadores del conjunto de reglas.

## Criterios de aceptación
- [x] Cambiando "hiper eficaz" a x3 en un conjunto de reglas, las consultas de ese modo lo reflejan.
- [x] El modo estándar sigue mostrando exactamente los mismos valores que antes de esta tarea.
- [x] `pnpm run build` sin errores.

## Fuera de alcance
La vista completa de Champions (6.3).

## Cómo se resolvió

**El recorrido va ahora clave → valor, no valor → clave.** Era el fallo de
diseño que bloqueaba la tarea: `lib/effectiveness.js` agrupaba por el número y
deducía la etiqueta de ahí, así que poner «hiper eficaz» a x3 metía esos tipos
en el cubo de x2 (3 está más cerca de 2 que de 4). Ahora:

1. el producto de la tabla de tipos decide la **categoría** — eso sale del cruce
   de tipos y no lo cambia nadie;
2. el conjunto de reglas decide **qué número se enseña** en esa categoría.

Las claves (`hiper_eficaz`…) siguen siendo canónicas: un conjunto puede decir
que «hiper eficaz» vale x3, no puede renombrar la categoría ni inventarse una.

### Cambios que no estaban en el encargo pero hacían falta

- **`lib/effectiveness.js` es una factoría** `createEffectiveness(db, multipliers)`.
  De paso deja de abrir su propia conexión a SQLite al importarse y de preparar
  la consulta de relaciones en cada cruce de tipos (18 por ficha).
- **`lib/catalog.js`, nuevo.** Las lecturas del catálogo estaban dentro de cada
  ruta y Champions necesitaba las mismas: había dos copias del mismo SELECT (la
  6.1 ya lo dejó anotado). Ahora están una sola vez y las usan `routes/pokemon.js`,
  `routes/types.js`, `routes/champions.js` y `lib/championsFilter.js`.
- **`middleware/sessionOverrides.js` decía `supereficaz`**, sin guion bajo, en
  sus etiquetas de respaldo. No se notaba porque solo se usan cuando la respuesta
  original no traía ese multiplicador; al indexar el panel por clave sí se
  habría notado (etiqueta vacía). Corregido a `super_eficaz`, que es el valor
  canónico.
- Las claves de i18n `effectiveness.x4`, `x2`… pasan a llamarse
  `effectiveness.hiper_eficaz`, `super_eficaz`… El texto es el mismo.

### Verificación del «no cambia nada» del modo estándar

Se capturaron las respuestas de `/api/pokemon/{1,6,25}`, `/api/types/{fuego,hada,normal}`
y los dos listados **antes** de tocar el motor, y se compararon después: **byte a
byte idénticas**. Es la forma de demostrar el segundo criterio de aceptación sin
depender de mirarlo a ojo.

### Detalles de implementación

- El motor de cada conjunto se **cachea por id** (construirlo lee los 18 tipos y
  prepara una consulta) y la caché se invalida al guardar o borrar.
- `GET /api/champions/:id/pokemon/:pokeId` responde **404** si el conjunto no
  permite ese Pokémon: en ese modo no existe. Los **tipos no se filtran**, son la
  física del juego y no contenido.
- La API devuelve la tabla de multiplicadores **completa** y un booleano
  `multipliers_custom`, para que el frontend no tenga que conocer los valores por
  defecto del proyecto. Por eso «Restablecer» es una petición propia con
  `multipliers: null` y no un cambio del borrador local.
