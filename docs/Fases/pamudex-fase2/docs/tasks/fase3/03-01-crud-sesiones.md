# Tarea 3.1 — CRUD de sesiones personalizadas

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Permitir crear "sesiones" independientes (Radical Red, Elite Redux, Emerald Rogue, Infinite Fusion, Mi ROM Hack...). Cada sesión es un contenedor de datos propio; en esta tarea solo se gestiona su ciclo de vida, no su contenido.

## Contexto extra
La tabla `sessions` YA existe en `backend/db/schema.sql`:
`id, profile_id, name, description, data_json, created_at`. El campo `data_json` guardará los overrides (tarea 3.2) — de momento déjalo como `"{}"`.
Todavía no hay perfiles de usuario (Fase 5): usa `profile_id = NULL`.

## Entregable
1. `backend/routes/sessions.js` — CRUD REST: `GET /api/sessions`, `POST /api/sessions`, `GET /api/sessions/:id`, `PUT /api/sessions/:id` (renombrar/descripción), `POST /api/sessions/:id/duplicate`, `DELETE /api/sessions/:id`.
2. Montarla en `backend/server.js`.
3. `frontend/src/lib/api.ts` — añadir el bloque `sessions`.
4. `frontend/src/pages/Sessions.tsx` en la ruta `/sesiones`: lista de sesiones en tarjetas, crear, renombrar, duplicar y borrar (con confirmación antes de borrar).
5. Guardar la sesión activa en `localStorage` bajo `pamudex_active_session` y mostrarla como seleccionada.
6. Añadir enlace a `/sesiones` en `TopBar.tsx` y claves i18n (`sessions.*`).

## Criterios de aceptación
- [ ] Crear una sesión, recargar la página y sigue ahí (persiste en SQLite, no en localStorage).
- [ ] Duplicar copia nombre + `data_json`, con nombre distinto ("… (copia)").
- [ ] Borrar pide confirmación.
- [ ] `npm run build` sin errores.

## Fuera de alcance
Los overrides de datos por sesión (3.2) y los formularios de edición (3.3/3.4).
