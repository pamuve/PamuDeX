# Tarea 5.4 — Historial y ajustes por perfil

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Que cada perfil conserve su historial de consultas y sus preferencias (idioma, tema, sesión activa).

## Contexto extra
Depende de 5.1. Las tablas `history(id, profile_id, entity_type, entity_ref, viewed_at)` y `settings(profile_id, key, value)` YA existen en `backend/db/schema.sql`.
Hoy el idioma se guarda en `localStorage` (`pamudex_lang`) — hay que migrarlo a `settings` cuando hay perfil activo, manteniendo `localStorage` como respaldo offline.

## Entregable
1. `backend/routes/history.js` — `POST` (registrar visita), `GET` (últimas N, por defecto 50), `DELETE` (limpiar historial).
2. `backend/routes/settings.js` — `GET /api/settings/:profileId` y `PUT` para guardar pares clave/valor.
3. Registrar automáticamente la visita al abrir cualquier ficha (Pokémon, tipo, movimiento, habilidad), con deduplicación: no registrar dos veces la misma entidad en menos de 5 minutos.
4. `frontend/src/pages/History.tsx` en `/historial` — lista cronológica con botón de limpiar (con confirmación).
5. `frontend/src/i18n/index.tsx` — leer/escribir el idioma en `settings` del perfil activo, con `localStorage` de respaldo.

## Criterios de aceptación
- [ ] Cambiar de idioma en el perfil A no cambia el del perfil B.
- [ ] Visitar la misma ficha varias veces seguidas no llena el historial de duplicados.
- [ ] Sin conexión al backend, la app sigue funcionando con las preferencias de `localStorage`.

## Fuera de alcance
Recomendaciones basadas en el historial (encaja mejor en la Fase 9).
