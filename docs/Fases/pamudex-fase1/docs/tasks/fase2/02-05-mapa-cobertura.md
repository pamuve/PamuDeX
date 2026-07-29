# Tarea 2.5 — Mapa de cobertura del equipo

## 1. Resumen del proyecto

PamuDeX es una PWA autoalojada y offline-first para consultar tipos, Pokémon, movimientos y habilidades. Stack: **React + TypeScript + Vite + TailwindCSS** (frontend) · **Node.js + Express + SQLite** (backend).

## 2. Contexto mínimo necesario

Depende de la tarea 2.1. Necesitas:

- `frontend/src/lib/team.ts` (`loadTeam`, tipos `Team`/`TeamSlot`)
- `frontend/src/types.ts`: `PokemonDetail.efectividad` (array de `{ multiplier, label, key, types: string[] }`, ya generado por el backend en `/api/pokemon/:id`).
- `backend/data/types.json` — lista de los 18 tipos con `id`, `name_es`, `color` (para poder mostrar todos aunque el equipo no tenga debilidad/resistencia en ellos).

Los 18 IDs de tipo son: `normal, fuego, agua, electrico, planta, hielo, lucha, veneno, tierra, volador, psiquico, bicho, roca, fantasma, dragon, siniestro, acero, hada`.

## 3. Convenciones

- Paleta OLED, `rounded-xl2 shadow-card bg-panel`, i18n con `useI18n().t(...)`.
- Reutiliza el componente `TypeBadge` (`frontend/src/components/TypeBadge.tsx`) para pintar cada tipo.

## 4. Entregable exacto

1. `frontend/src/lib/coverage.ts` con una función `analyzeTeamCoverage(team: TeamSlot[], pokemonById: Record<number, PokemonDetail>): CoverageReport` que calcule:
   - **Debilidad global**: tipos ante los que 2 o más Pokémon del equipo tienen multiplicador ≥ 2.
   - **Tipos que nadie resiste**: tipos ante los que NINGÚN Pokémon del equipo tiene multiplicador ≤ 0.5.
   - **Tipos demasiado repetidos**: tipos de Pokémon que aparecen 3 o más veces en el equipo (tipo ofensivo/defensivo del propio Pokémon, no de sus movimientos).
   - **Cobertura ofensiva**: de los movimientos configurados en cada `TeamSlot`, qué tipos del juego quedan sin ningún movimiento que sea al menos "normal" (x1) contra ellos.
   - **Cobertura defensiva**: combinación de las `efectividad` de los 6 Pokémon, para ver qué tipos ofensivos rivales golpean fuerte a más de la mitad del equipo.
2. `frontend/src/components/CoverageMap.tsx` — visualización con 4 secciones (una por cada punto de arriba), usando `TypeBadge` para los tipos y un color de acento distinto por sección (reutiliza el patrón de `EffectivenessPanel.tsx`).
3. Añadir esta vista a la página `/equipo` (sección "Cobertura del equipo").

## 5. Archivos a crear/modificar

- `frontend/src/lib/coverage.ts`
- `frontend/src/components/CoverageMap.tsx`
- `frontend/src/pages/TeamBuilder.tsx` — integrar la sección
- `frontend/src/i18n/es.json` / `en.json` — claves `coverage.title`, `coverage.global_weakness`, `coverage.no_resist`, `coverage.overrepresented`, `coverage.offensive`, `coverage.defensive`

## 6. Criterios de aceptación

- [ ] Con un equipo de 6 Pokémon del mismo tipo, "tipos demasiado repetidos" señala ese tipo.
- [ ] Si ningún Pokémon del equipo resiste Hielo, por ejemplo, "tipos que nadie resiste" lo incluye.
- [ ] Con un equipo vacío o incompleto (menos de 6), la función no lanza error — trabaja con los que haya.
- [ ] `npm run build` sin errores de TypeScript.

## 7. Fuera de alcance

- Recomendaciones 1 contra 1 (tarea 2.4, ya resuelta de forma independiente).
- Sugerencias automáticas de qué Pokémon añadir para tapar huecos — eso encaja mejor en la Fase 9 (IA que recomienda equipos).
