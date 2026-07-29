# Tarea 5.3 — Favoritos por perfil

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Marcar Pokémon, movimientos, habilidades y tipos como favoritos, por perfil.

## Contexto extra
Depende de 5.1. Necesitarás una tabla nueva (no existe en el esquema):
`favorites(id, profile_id, entity_type, entity_ref, created_at)` con índice único en `(profile_id, entity_type, entity_ref)`.
`entity_type` ∈ `pokemon | move | ability | type`. Añádela a `backend/db/schema.sql`.

## Entregable
1. Migración/actualización de `schema.sql` + `backend/routes/favorites.js` (`GET`, `POST`, `DELETE`).
2. `frontend/src/components/FavoriteButton.tsx` — icono de estrella pulsable, optimista (cambia al instante y revierte si falla).
3. Integrarlo en `PokemonDetail`, `MoveDetail`, `AbilityDetail` y `TypeDetail`.
4. `frontend/src/pages/Favorites.tsx` en `/favoritos` — agrupados por tipo de entidad, con enlace a cada ficha.
5. Claves i18n `favorites.*`.

## Criterios de aceptación
- [ ] Marcar un favorito con el perfil A no lo muestra en el perfil B.
- [ ] Pulsar dos veces la estrella deja el estado limpio (no duplica filas).
- [ ] `/favoritos` vacío muestra un mensaje útil, no una página en blanco.

## Fuera de alcance
Historial (5.4) y sincronización entre dispositivos.
