# Tarea 6.0 — Objetos en el dataset

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.
> Tarea añadida al preparar la Fase 6; no estaba en el roadmap original.
> Ver el porqué en `docs/tasks/fase6/00-preparacion.md`, punto 5.

## Objetivo

Que los objetos existan como dato de primera clase, igual que Pokémon,
movimientos y habilidades. Sin esto la 6.1 no puede marcar «objetos permitidos»:
la tabla `items` está en el esquema desde la Fase 1 pero **vacía**, no hay
`backend/data/items.json` y `tools/fetch-dataset.js` no los descarga.

## Contexto extra

- Tabla existente: `items(id, name_es, name_en, category, effect_es)`.
- El dataset se regenera con `node tools/fetch-dataset.js`, que **conserva las
  entradas que ya existen** en los JSON (están corregidas a mano) y solo añade
  las que faltan. Los JSON van versionados: la PWA es offline-first.
- `db/populate.js` lo comparten la siembra y `/api/export/sqlite`. Cualquier
  cosa que se añada ahí tiene que seguir funcionando cuando el dataset no trae
  objetos, o la exportación revienta.

### Dos trampas que ya están identificadas

**1. `pnpm run seed` BORRA la base de datos.** Recrearla se lleva por delante
perfiles, sesiones, favoritos, historial y ajustes. Una instalación en marcha no
puede sembrar objetos así: tienen que entrar por `db/migrate.js`, que corre en
cada arranque y es idempotente y solo aditivo. La migración siembra los objetos
**solo si la tabla está vacía**.

**2. La descripción en español de PokeAPI está mal en el grupo `x-y`.** Para
`leftovers` (Restos) devuelve la del Pañuelo Seda; para `life-orb` (Vidasfera),
la de un objeto de Velocidad. El helper `describe()` del fetcher coge la
**primera** entrada en español, que es justo la de `x-y`. Las de grupos
posteriores (`sun-moon` en adelante) sí son correctas, así que hay que quedarse
con la **más reciente**. Los nombres (`names`) sí son fiables.

**3. PokeAPI no sabe qué objetos son equipables.** Se comprobó al implementar
esto: el Chaleco Asalto y el Casco Dentado llegan **sin `attributes`**, mientras
que la Poción y la Master Ball sí traen `holdable`. Derivar de ahí un campo
«equipable» se equivocaría en las dos direcciones, así que **no se guarda**. Lo
fiable es `category` (54 categorías), y es con lo que la 6.1 puede agrupar.

## Entregable

1. `backend/tools/fetch-dataset.js` — bloque `items`, invocable suelto
   (`node tools/fetch-dataset.js items`), que respete la regla de conservar lo
   existente y que tome la descripción en español más reciente.
2. `backend/data/items.json` — generado y versionado, en formato semilla:
   `{ name_es, name_en, category, effect_es }`.
3. `backend/db/migrate.js` — siembra de objetos cuando la tabla está vacía. El
   esquema no cambia: `items` ya tiene las cuatro columnas que hacen falta.
4. `backend/db/populate.js` + `db/seed.js` — volcado de objetos, **opcional**:
   un dataset sin `items` debe seguir funcionando.
5. `backend/routes/items.js` + `server.js` — `GET /api/items` (listado ligero,
   con filtros `?category=` y `?q=`), `GET /api/items/categories` y
   `GET /api/items/:id`.
6. `frontend/src/types.ts` y `lib/api.ts` — tipos y bloque `items`.

## Criterios de aceptación

- [x] `GET /api/items` devuelve los objetos con su nombre en español.
- [x] La descripción de Restos habla de restaurar PS, no de pañuelos.
- [x] Arrancar el servidor con una base ya existente siembra los objetos **sin
      tocar** perfiles ni sesiones, y arrancarlo dos veces no los duplica.
- [x] `GET /api/export/sqlite` sigue funcionando.
- [x] `node tests/overrides.smoke.js` y `node tests/history.smoke.js` pasan.
- [x] `pnpm exec tsc --noEmit` y `pnpm run build` sin errores.

## Resultado

**2151 objetos** en 54 categorías, 394 KB de JSON. De las 2223 entradas de
PokeAPI se colapsan 72: son variantes del mismo objeto según el juego
(`poke-ball` / `lapoke-ball` de Leyendas Arceus, `firium-z--held` / `--bag`,
llaves de cada región…), y agruparlas por nombre es lo correcto en una Pokédex.
605 objetos se quedan sin descripción porque PokeAPI no la tiene en ningún
idioma; son entradas sin uso en los juegos.

## Fuera de alcance

- **Interfaz de objetos** (listado, ficha, buscador). Aquí solo se crea el dato y
  su API; quien los pinta es la 6.1 (editor de reglas de Champions).
- **Exportación e importación de objetos** (Fase 4). `populate` los admite, pero
  `lib/dataset.js` e `importValidator.js` siguen sin conocerlos, así que un
  `.sqlite` exportado no los lleva. Anotarlo como pendiente.
- **Overrides de objetos por sesión** (Fase 3). El middleware sigue cubriendo
  solo types/pokemon/moves/abilities y `/search`.
