# Tarea 3.4 — Editores de tipos, movimientos, habilidades y relaciones

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Completar el editor visual con el resto de entidades, reutilizando el patrón de la tarea 3.3.

## Contexto extra
Depende de 3.1, 3.2 y 3.3 (adjunta `PokemonForm.tsx` y `EditorPokemon.tsx` para reutilizar su estructura y no duplicar lógica).

## Entregable
1. `frontend/src/components/forms/TypeForm.tsx` — nombre es/en y color (selector de color).
2. `frontend/src/components/forms/MoveForm.tsx` — tipo, categoría (físico/especial/estado), potencia, precisión, PP, prioridad, contacto, efecto.
3. `frontend/src/components/forms/AbilityForm.tsx` — nombre es/en, generación, efecto.
4. `frontend/src/components/forms/RelationsMatrix.tsx` — **matriz 18x18** de atacante contra defensor, cada celda ciclable entre `x0 / x0.25 / x0.5 / x1 / x2 / x4` al pulsarla, con color según el valor. Debe ser usable en móvil: scroll horizontal con cabecera fija.
5. `frontend/src/pages/Editor.tsx` en `/editor` — página contenedora con pestañas: Pokémon | Tipos | Movimientos | Habilidades | Relaciones.
6. Extraer si hace falta un hook común `useSessionOverride(entity, id)` en `frontend/src/hooks/`.

## Criterios de aceptación
- [ ] Cambiar en la matriz Fuego→Agua a x2 se refleja en `/tipo/fuego` con esa sesión activa.
- [ ] Cada editor tiene su botón de restaurar valores originales.
- [ ] La matriz es navegable en una pantalla de 4".
- [ ] `npm run build` sin errores.

## Fuera de alcance
Import/export de esos datos (Fase 4).
