# Tarea 4.2 — Exportar a SQLite

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Descargar un archivo `.sqlite` autocontenido con los datos (dataset global o una sesión con sus overrides ya aplicados).

## Contexto extra
Depende de 4.1 (ruta `backend/routes/export.js` ya creada) y de la Fase 3 para los overrides.
Clave: si se pide una sesión, hay que generar una base **nueva** con los overrides ya fusionados, no copiar la base original. Genera el archivo en un directorio temporal (`os.tmpdir()`), envíalo y bórralo después.

## Entregable
1. `GET /api/export/sqlite?session=<id>` en `backend/routes/export.js`:
   - Crea una DB temporal aplicando `backend/db/schema.sql`.
   - La puebla con los datos resueltos (globales + overrides de la sesión).
   - La envía con `res.download()` y limpia el temporal al terminar (también si falla).
2. Botón correspondiente en `frontend/src/pages/ImportExport.tsx`.

## Criterios de aceptación
- [ ] El `.sqlite` descargado se abre con `sqlite3` y contiene todas las tablas del esquema.
- [ ] Exportando una sesión con overrides, los valores modificados están ya aplicados en las filas.
- [ ] No quedan archivos temporales tras varias descargas seguidas.

## Fuera de alcance
Importación (4.3 y 4.4).
