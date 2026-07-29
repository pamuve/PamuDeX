# Tarea 5.1 — Pantalla de perfiles estilo Netflix

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Pantalla inicial con una lista de perfiles (avatar, nombre, color), como Netflix. Al elegir uno se entra en la app con sus datos.

## Contexto extra
Las tablas `users` y `profiles` YA existen en `backend/db/schema.sql`:
`profiles(id, user_id, name, avatar, color, language, theme)`.
Como es una app autoalojada de uso doméstico, el modelo es "un hogar, varios perfiles": no hace falta login real todavía (la contraseña opcional llega en 5.2).

## Entregable
1. `backend/routes/profiles.js` — CRUD: listar, crear, editar (nombre/avatar/color), borrar.
2. Montar en `server.js` y añadir el bloque `profiles` a `frontend/src/lib/api.ts`.
3. `frontend/src/pages/ProfileSelect.tsx` en `/perfiles` — rejilla de tarjetas grandes y táctiles con avatar circular del color del perfil y su inicial, más una tarjeta "+ Nuevo perfil".
4. `frontend/src/lib/profile.ts` — perfil activo en `localStorage` (`pamudex_active_profile`) + helper `getActiveProfile()`.
5. Redirección: si no hay perfil activo, `/` lleva a `/perfiles`.
6. Mostrar el perfil activo en `TopBar.tsx` y permitir cambiarlo desde ahí.

## Criterios de aceptación
- [ ] Con la app recién instalada, la primera pantalla es la de perfiles.
- [ ] Crear, renombrar y borrar perfiles funciona y persiste en SQLite.
- [ ] El perfil activo sobrevive a recargar la página.
- [ ] Las tarjetas son cómodas de pulsar en una pantalla de 4".

## Fuera de alcance
Contraseñas (5.2), favoritos (5.3), historial y ajustes por perfil (5.4).
