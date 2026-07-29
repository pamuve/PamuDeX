# Tarea 8.2 — Navegación por teclado y lectores de pantalla

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Que la app sea utilizable por completo sin ratón y con lector de pantalla.

## Contexto extra
Ya existe un estilo global `:focus-visible` en `index.css`, pero no se ha auditado nada.
Puntos conflictivos conocidos: el menú desplegable de `TopBar.tsx`, el autocompletado de `SearchBar.tsx`, los selectores de movimiento de `TeamSlotCard.tsx` y `RivalSlotCard.tsx`, y (si existe ya) la matriz 18x18 de relaciones.

## Entregable
1. Auditoría y corrección de toda la app:
   - Orden de tabulación lógico en cada página.
   - Menús y desplegables: navegables con flechas, cierre con `Escape`, foco devuelto al disparador al cerrar.
   - Autocompletado con el patrón `combobox` (`role`, `aria-expanded`, `aria-activedescendant`, flechas + `Enter`).
   - `aria-label` en todos los botones que solo tienen icono.
   - Enlace "saltar al contenido" al principio de la página.
2. Anunciar cambios dinámicos importantes con una región `aria-live` (por ejemplo, cuando se recalculan las recomendaciones del comparador).
3. Comprobar que los colores de tipo mantienen contraste suficiente con el texto que llevan encima.

## Criterios de aceptación
- [ ] Se puede añadir un Pokémon al equipo, configurarlo y leer la recomendación usando solo el teclado.
- [ ] Ningún control interactivo queda sin nombre accesible.
- [ ] `Escape` cierra cualquier menú abierto y devuelve el foco donde estaba.

## Fuera de alcance
Traducción a más idiomas (la arquitectura i18n ya lo soporta añadiendo un JSON).
