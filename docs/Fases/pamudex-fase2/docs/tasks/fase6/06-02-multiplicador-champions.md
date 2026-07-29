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
- [ ] Cambiando "hiper eficaz" a x3 en un conjunto de reglas, las consultas de ese modo lo reflejan.
- [ ] El modo estándar sigue mostrando exactamente los mismos valores que antes de esta tarea.
- [ ] `npm run build` sin errores.

## Fuera de alcance
La vista completa de Champions (6.3).
