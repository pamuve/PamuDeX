# Tarea 2.1 — Modelo de equipo + UI "Mi equipo"

## 1. Resumen del proyecto

PamuDeX es una PWA autoalojada y offline-first para consultar tipos, Pokémon, movimientos y habilidades, con arquitectura preparada para comparador de equipos, sesiones ROM Hack, editor visual, perfiles multiusuario y modo Champions.
Stack: **React + TypeScript + Vite + TailwindCSS** (frontend) · **Node.js + Express + SQLite/better-sqlite3** (backend) · Docker de un solo contenedor.

## 2. Contexto mínimo necesario

La Fase 1 ya expone estas rutas (adjúntalas si puedes, o usa esta descripción):

- `GET /api/pokemon` → `{ id, dex, name_es, name_en, generation }[]`
- `GET /api/pokemon/:id` → ficha completa: `{ id, dex, name_es, types: {id,name_es,color}[], abilities: {name_es,effect_es}[], hidden_ability, stats: {hp,atk,def,spa,spd,spe}, height_m, weight_kg, efectividad: [...] }`
- `GET /api/moves` → `{ id, name_es, type_id, color, category, power, accuracy, pp }[]`

Tipos TS ya existentes en `frontend/src/types.ts` (adjúntalo tal cual): `PokemonSummary`, `PokemonDetail`, `MoveSummary`, `PokeType`.

No existe todavía ninguna tabla de "equipos" en la base de datos — la creas tú en esta tarea.

## 3. Convenciones

- Colores OLED: base `#0A1425`, panel `#132238`, hover `#1C3350`, texto `#F5F7FA`, texto secundario `#A9BDD2`. Nunca negro puro.
- Tarjetas: `rounded-xl2 shadow-card bg-panel`, animación `animate-fadein`.
- i18n: usa `useI18n().t("clave")`; añade claves nuevas a `frontend/src/i18n/es.json` y `en.json` (mismo par clave/valor en ambos).
- Componentes reutilizables en `frontend/src/components/`, páginas con ruta en `frontend/src/pages/`, añadir la ruta nueva en `frontend/src/App.tsx`.
- El equipo se guarda **en el navegador** por ahora (no hay backend de usuarios todavía — eso es la Fase 5): usa `localStorage` con la clave `pamudex_team_own`.

## 4. Entregable exacto

Una página `/equipo` con un panel "Mi equipo" que permite:

1. Añadir hasta 6 Pokémon (buscador con autocompletado, reutilizando el patrón de `SearchBar.tsx` si ayuda).
2. Por cada Pokémon del equipo, configurar:
   - Objeto (de momento un campo de texto libre; no hay tabla `items` con datos todavía — el esquema SQL ya tiene la tabla `items` vacía y preparada, puedes usarla si prefieres una lista básica).
   - Habilidad (desplegable con las habilidades reales de ese Pokémon, viene en la ficha `/api/pokemon/:id`).
   - Naturaleza (lista fija de las 25 naturalezas estándar de Pokémon, defínela como constante local).
   - Hasta 4 movimientos (buscador sobre `/api/moves`).
3. Quitar/reordenar Pokémon del equipo.
4. El estado del equipo se persiste en `localStorage` y se recupera al recargar.

No implementes todavía nada de rival, daño ni recomendaciones — eso son las tareas 2.2, 2.3 y 2.4.

## 5. Archivos a crear/modificar

- `frontend/src/types.ts` — añadir tipos `Nature`, `TeamSlot`, `Team` (exportados).
- `frontend/src/lib/team.ts` — helpers `loadTeam()`, `saveTeam(team)`, lectura/escritura en `localStorage`.
- `frontend/src/components/TeamSlotCard.tsx` — tarjeta de un Pokémon del equipo con sus selectores.
- `frontend/src/pages/TeamBuilder.tsx` — página `/equipo` con el panel "Mi equipo".
- `frontend/src/App.tsx` — añadir la ruta `/equipo`.
- `frontend/src/i18n/es.json` y `en.json` — claves nuevas (`team.title`, `team.add_pokemon`, `team.item`, `team.ability`, `team.nature`, `team.moves`, etc.).

## 6. Criterios de aceptación

- [ ] Se pueden añadir hasta 6 Pokémon y no se puede añadir un séptimo (el botón/acción se deshabilita o se oculta).
- [ ] Cambiar de página y volver a `/equipo` conserva el equipo (persistencia en `localStorage`).
- [ ] El desplegable de habilidad solo muestra habilidades reales del Pokémon elegido (incluida la oculta).
- [ ] TypeScript compila sin errores (`npm run build` en `frontend/`).

## 7. Fuera de alcance

- Equipo rival (2.2), cálculo de daño (2.3), recomendaciones (2.4), cobertura (2.5).
- Persistencia en backend/base de datos — eso llegará con el sistema de perfiles (Fase 5); de momento todo es `localStorage`.
