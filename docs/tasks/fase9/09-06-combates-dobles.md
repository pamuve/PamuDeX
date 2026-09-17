# Tarea 9.6 — Combates dobles en el comparador de equipos

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Que `/equipo` entienda los **combates dobles**: elegir el formato (individual o
doble) y marcar **qué Pokémon están en el campo este turno** —dos propios y dos
rivales— para que el motor de daño, la recomendación y el mapa de cobertura
respondan a ese emparejamiento concreto y no a un 1 contra 1 abstracto.

## Contexto extra
El comparador de la Fase 2 es 1v1 de principio a fin:

- `frontend/src/lib/team.ts` guarda `Team` / `RivalTeam` en `localStorage`
  (`pamudex_team_own`, `pamudex_team_rival`) como una lista de huecos, sin
  ninguna noción de campo ni de turno.
- `frontend/src/lib/recommendation.ts` expone `bestResponseAgainst(rival, ...)`:
  puntúa **cada** Pokémon propio contra **un** rival. En dobles la mejor
  respuesta depende de la pareja enemiga entera y de la pareja propia, así que
  esa firma no basta.
- `frontend/src/lib/damage.ts` (`estimateDamage`, `bestMoveAgainst`) y
  `frontend/src/lib/coverage.ts` (`analyzeTeamCoverage`) tampoco distinguen
  objetivos.

**El dataset no sabe a quién apunta un movimiento.** `backend/data/moves.json`
tiene `power`, `accuracy`, `pp`, `priority`, `makes_contact`… pero **no**
`target`, y sin ese campo no se puede saber qué movimiento golpea a los dos
rivales (Terremoto, Surf, Otra Dimensión) ni aplicar la reducción a 0,75 de los
ataques de área. Hay que importarlo:

- `move.target` de PokeAPI en `backend/tools/fetch-dataset.js` (respetando la
  regla del archivo: lo escrito a mano no se pisa).
- Columna nueva `target` en la tabla `moves` desde `db/migrate.js`, **aditiva e
  idempotente** — nunca resembrando, que `pnpm run seed` borra perfiles,
  sesiones, favoritos e historial.
- Un movimiento sin `target` vale `null` = desconocido y se trata como objetivo
  único, igual que `makes_contact` (`null` no es «no»).

## Entregable
1. **Modelo**: `format: "single" | "double"` y los huecos activos del turno en
   `Team` / `RivalTeam` (`frontend/src/types.ts` + `lib/team.ts`). Un equipo ya
   guardado en `localStorage` **no tiene esos campos**: el `safeParse` existente
   debe seguir cargándolo y caer en individual sin campo activo, sin borrar nada.
2. **Dataset**: `target` en `moves.json`, en el importador, en la columna nueva
   por migración y en `MoveSummary`.
3. **Motor**: daño de área reducido a 0,75 cuando el movimiento golpea a más de
   un objetivo, y una recomendación que puntúe contra **la pareja** rival en el
   campo, no contra un rival suelto. La API 1v1 actual debe seguir funcionando
   para el formato individual.
4. **UI**: selector de formato en `/equipo`, marcado de los dos activos por
   bando (propios y rivales) con teclado y nombre accesible, y recálculo en vivo
   al cambiar de activos. Claves nuevas en `es.json` **y** `en.json`.
5. En dobles, el panel de recomendación explica el porqué con los mismos motivos
   (✓) de `RecommendationCard`, añadiendo los que solo existen aquí (golpea a
   los dos, el compañero es inmune al área propia…).

## Criterios de aceptación
- [ ] Un equipo guardado antes de esta tarea se sigue cargando y se comporta
      como individual.
- [ ] En individual, el comparador da exactamente los mismos números que antes.
- [ ] En dobles no se pueden marcar más de dos activos por bando, y con menos de
      dos el panel lo dice en vez de calcular a medias.
- [ ] Un movimiento de área contra dos objetivos se estima al 75 %.
- [ ] Cambiar un activo recalcula recomendación y cobertura sin recargar.
- [ ] `cd frontend && pnpm run check:i18n && pnpm exec tsc --noEmit && pnpm run build`
- [ ] `cd backend && pnpm test` y `pnpm run check:changes` siguen en verde.

## Fuera de alcance
Turnos encadenados, cambios de Pokémon a mitad de combate y estados persistentes
(clima, terreno, pantallas): eso es el simulador de la 9.2. Aquí se analiza **un
turno** con las cuatro casillas puestas. Tampoco entran los formatos triple ni
combate múltiple.
