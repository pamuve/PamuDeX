# Tarea 7.3 — Historial de cambios por entidad

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Una vista de "qué cambió y cuándo" por Pokémon, movimiento, habilidad o tipo, más los datos históricos más relevantes ya cargados.

## Contexto extra
Depende de 7.1 y 7.2.
Sobre los datos: cargar el historial completo de las 9 generaciones es un trabajo de datos enorme. Empieza por un conjunto acotado y bien documentado (los cambios más conocidos: el tipo Hada en Gen 6 y su efecto sobre Dragón/Siniestro/Lucha, Acero perdiendo la resistencia a Fantasma y Siniestro en Gen 6, la división físico/especial de Gen 4, cambios de potencia de movimientos habituales). Deja el formato preparado para ampliarlo poco a poco.

## Entregable
1. `backend/data/entity_changes.json` — conjunto inicial de cambios documentados, con el mismo estilo de los demás seeds.
2. `backend/db/seed.js` — cargarlo en la tabla `entity_changes`.
3. `GET /api/history/:entityType/:entityRef` → cambios ordenados por generación.
4. `frontend/src/components/ChangeHistory.tsx` — línea temporal vertical por generación, integrada en las páginas de ficha (colapsable, cerrada por defecto).
5. Documentar en el README cómo añadir más entradas al historial.

## Criterios de aceptación
- [ ] La ficha de un Pokémon afectado por la llegada del tipo Hada muestra ese cambio en su línea temporal.
- [ ] `npm run seed` carga el historial sin errores.
- [ ] Las entidades sin historial no muestran la sección vacía.

## Fuera de alcance
Cobertura histórica exhaustiva de las 9 generaciones (trabajo incremental continuo).
