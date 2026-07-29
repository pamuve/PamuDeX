# Tarea 9.1 — Calculadora de daño completa

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.
> **Tarea grande**: divídela en las cuatro subtareas de abajo, una por conversación.

## Objetivo
Sustituir la estimación simplificada de la Fase 2 por una calculadora fiel, con rangos de daño reales.

## Contexto extra
`frontend/src/lib/damage.ts` (Fase 2) usa: nivel fijo 50, sin EVs/IVs, sin naturaleza, sin objetos, sin clima, y con el factor aleatorio medio (0.925). La tabla de las 25 naturalezas ya existe en `frontend/src/lib/team.ts` (`NATURES`).
Mantén la API antigua funcionando o migra todas sus llamadas; no dejes el comparador roto a medias.

## Subtareas
- **9.1.a — Estadísticas reales**: fórmula de PS y del resto de estadísticas a partir de base + IVs (0-31) + EVs (0-252, máx 510) + naturaleza + nivel configurable. UI para editarlos por Pokémon del equipo.
- **9.1.b — Rango de daño**: sustituir el 0.925 fijo por los 16 valores del rango real (85%-100%); devolver mínimo, máximo y probabilidad de debilitar (por ejemplo "62.5% de probabilidad de KO").
- **9.1.c — Modificadores**: objetos (bayas, Vidasfera, potenciadores de tipo), clima (sol, lluvia, tormenta de arena, granizo), terrenos, pantallas (Reflejo/Pantalla Luz), golpe crítico, cambios de estadística (-6 a +6).
- **9.1.d — Interfaz**: página `/calculadora` con atacante, defensor, movimiento y todos los modificadores, mostrando el rango y los cálculos intermedios (que se entienda de dónde sale el número).

## Criterios de aceptación
- [ ] Los resultados coinciden con una calculadora de referencia conocida en varios casos de prueba documentados.
- [ ] El comparador de equipos (Fase 2) sigue funcionando.

## Fuera de alcance
Simulación de combate por turnos (9.2).
