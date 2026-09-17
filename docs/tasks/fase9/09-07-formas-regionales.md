# Tarea 9.7 — Formas regionales

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Incorporar las **formas regionales** (Alola, Galar, Hisui, Paldea) como fichas
propias: sus tipos, habilidades y estadísticas son distintos de los de la forma
original, y hoy la app solo conoce una entrada por número de Pokédex.

## Contexto extra
`backend/data/pokemon.json` tiene **1025 entradas, una por `dex`**, y de ahí sale
todo lo demás. Una forma regional rompe la suposición de que «un Pokémon = un
número de Pokédex», que está metida en cuatro sitios y hay que resolver los
cuatro antes de tocar datos:

1. **Sprites.** `components/PokemonSprite.tsx` pide `/sprites/<dex>.png` y
   `tools/fetch-sprites.js` los baja así. Vulpix de Alola y Vulpix compartirían
   imagen. Hace falta una clave de sprite que distinga la forma **sin volver al
   nombre**: el nombre no vale porque un ROM Hack lo renombra con un override, y
   esa es justo la razón por la que el sprite va por número.
2. **`entity_changes`.** Su `ref` para Pokémon **es el número de Pokédex**
   (`backend/data/entity_changes.json`). Dos entidades con el mismo `dex`
   recibirían el mismo historial de cambios entre generaciones.
3. **Ids que ya están guardados.** Favoritos e historial referencian
   `pokemon.id` (`FavoriteButton` recibe `poke.id`), y las reglas de Champions
   guardan listas de ids. Las formas se **añaden** con ids nuevos por
   `db/migrate.js`, condicionado a que no estén ya; renumerar el catálogo
   existente dejaría favoritos, historial y reglas apuntando a otro Pokémon.
4. **Listados y buscador.** Son 1025 tarjetas; meter las formas sin distintivo
   deja dos «Vulpix» seguidos sin forma de saber cuál es cuál.

Decidir y dejar escrito **cómo se identifica una forma** es el primer paso de la
tarea, no un detalle de implementación: de esa decisión dependen la ruta de la
ficha (`/pokemon/:id` ya usa el id, no el dex), la clave del sprite, la clave de
la caché de IndexedDB y el `ref` de los cambios históricos.

## Entregable
1. Decisión escrita (en el propio PR o en `docs/`) sobre la identidad de una
   forma: campo nuevo en el dataset (`form`, `form_es`/`form_en`), qué pasa a ser
   único y cómo queda la clave del sprite.
2. `tools/fetch-dataset.js` importa las formas regionales desde PokeAPI
   (`pokemon-species` → `varieties`), conservando lo escrito a mano como hasta
   ahora, y `tools/fetch-sprites.js` baja sus imágenes con la clave nueva.
3. Siembra **por `db/migrate.js`**, aditiva e idempotente, con columnas nuevas y
   sin tocar las filas existentes ni sus ids.
4. Frontend: distintivo de forma en listados, buscador y ficha; enlace entre las
   formas de un mismo Pokémon; `PokemonSprite` con la clave nueva y la inicial
   de reserva intacta. Claves en `es.json` **y** `en.json`.
5. El editor de ROM Hacks trata una forma como un Pokémon más: los overrides de
   sesión ya van por id y no deberían necesitar cambios — compruébalo.

## Criterios de aceptación
- [ ] Vulpix de Alola aparece como hielo, con sus estadísticas y habilidades, y
      no pisa al Vulpix original.
- [ ] Cada forma enseña su propio sprite; si falta el archivo, sale la inicial.
- [ ] Los favoritos, el historial y las reglas de Champions guardados antes de
      la tarea siguen apuntando al mismo Pokémon.
- [ ] Arrancar dos veces seguidas no duplica formas (migración idempotente).
- [ ] Buscar «Vulpix» distingue las dos entradas en el resultado.
- [ ] `cd frontend && pnpm run check:i18n && pnpm exec tsc --noEmit && pnpm run build`
- [ ] `cd backend && pnpm test` y `pnpm run check:changes` siguen en verde.

## Fuera de alcance
Megaevoluciones, Gigamax, formas de combate (Deoxys, Rotom, Urshifu) y
cambios de forma en mitad del combate. La estructura que salga de aquí debería
valerles, pero los datos son otra tarea.
