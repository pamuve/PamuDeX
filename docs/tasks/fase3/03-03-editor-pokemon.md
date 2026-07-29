# Tarea 3.3 — Editor visual de Pokémon

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Formulario visual para editar un Pokémon dentro de una sesión. **Nunca se edita JSON a mano.**

## Contexto extra
Depende de 3.1 (sesiones) y 3.2 (overrides + `PUT` de `data_json`).
Campos editables: nombre (es/en), número de Pokédex, generación, tipos (1 o 2, desplegables con los 18 tipos), habilidades, habilidad oculta, las 6 estadísticas base, altura, peso, ruta de sprite.

## Entregable
1. `frontend/src/components/forms/PokemonForm.tsx` — formulario controlado con validación básica (stats 1-255, máximo 2 tipos, dex > 0).
2. `frontend/src/pages/EditorPokemon.tsx` en `/editor/pokemon`: buscador de Pokémon a la izquierda, formulario a la derecha (apilado en móvil).
3. Al guardar: escribe el override en `data_json` de la sesión activa vía `PUT /api/sessions/:id` y muestra confirmación visual.
4. Botón "Restaurar valores originales" que elimina el override de ese Pokémon.
5. Indicador visual claro de qué campos están modificados respecto al valor global (por ejemplo, borde de acento o etiqueta "modificado").
6. Claves i18n `editor.*`.

## Criterios de aceptación
- [ ] Editar la velocidad de Pikachu y verla reflejada al instante en `/pokemon/25` con esa sesión activa.
- [ ] "Restaurar" devuelve el valor global.
- [ ] Sin sesión activa, la página avisa de que hay que crear/seleccionar una sesión.
- [ ] `npm run build` sin errores.

## Fuera de alcance
Editores de tipos/movimientos/habilidades/relaciones (tarea 3.4) y subida de imágenes de sprite (Fase 9).
