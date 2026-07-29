# Tarea 7.2 — Vista "Todas las generaciones"

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Una vista unificada que muestra la información **más reciente** y, cuando existan diferencias históricas, las señala con etiquetas visibles.

## Contexto extra
Depende de 7.1 (`entity_changes`, `GenerationSelector`).
Regla de diseño: el valor actual manda y se ve grande; lo histórico es una anotación, no debe competir visualmente con el dato principal.

## Entregable
1. Opción "Todas las generaciones" dentro de `GenerationSelector.tsx` (valor por defecto).
2. `frontend/src/components/ChangeTag.tsx` — etiqueta pequeña junto a un campo modificado; al pulsarla o pasar el ratón muestra qué cambió y en qué generación (por ejemplo, "Gen 6: era tipo Normal").
3. Aplicarlo a los campos con historial en las fichas de Pokémon, movimiento, habilidad y tipo.
4. Debe funcionar por pulsación en móvil, no solo con `hover`.
5. Claves i18n `generations.*`.

## Criterios de aceptación
- [ ] En "Todas las generaciones" se ve el valor actual con las etiquetas de cambios donde corresponda.
- [ ] Las etiquetas son accesibles con teclado y por toque.
- [ ] Los campos sin historial no muestran ninguna etiqueta.

## Fuera de alcance
Cargar el conjunto real de datos históricos (7.3).
