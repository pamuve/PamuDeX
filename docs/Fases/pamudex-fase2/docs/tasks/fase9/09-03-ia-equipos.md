# Tarea 9.3 — Recomendador de equipos

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Sugerir qué Pokémon añadir para tapar los huecos de cobertura de un equipo.

## Contexto extra
Depende de la Fase 2: `frontend/src/lib/coverage.ts` ya calcula debilidad global, tipos que nadie resiste, tipos repetidos y huecos ofensivos. Aquí se trata de **actuar** sobre ese informe.
Sobre el nombre: llámalo recomendador y no "IA". Es un algoritmo de puntuación explicable, y eso es una ventaja — el usuario puede entender y discutir el porqué de cada sugerencia. No hace falta ningún modelo de aprendizaje automático.

## Entregable
1. `frontend/src/lib/teamSuggestions.ts` — `suggestAdditions(team, allPokemon, coverageReport)` que puntúa a cada candidato por: cuántos huecos defensivos cubre, cuántos tipos sin resistencia resuelve, si evita agravar la debilidad global y si aporta tipos poco representados.
2. Cada sugerencia devuelve sus motivos en el mismo formato de razones (✓) que ya usa `RecommendationCard`.
3. Sección "Sugerencias" en `/equipo` con los 5 mejores candidatos y un botón para añadirlos directamente.
4. Recalcular en vivo al cambiar el equipo.

## Criterios de aceptación
- [ ] Con un equipo débil a Tierra, sugiere Pokémon que la resistan o sean inmunes.
- [ ] Cada sugerencia muestra al menos un motivo concreto y comprensible.
- [ ] Con el equipo lleno (6), la sección propone sustituciones o se oculta.

## Fuera de alcance
Sugerir conjuntos completos de movimientos y objetos (ampliación posterior).
