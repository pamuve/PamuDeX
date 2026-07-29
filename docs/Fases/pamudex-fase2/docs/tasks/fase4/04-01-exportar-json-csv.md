# Tarea 4.1 — Exportar a JSON y CSV

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Poder sacar los datos de PamuDeX (dataset global o una sesión concreta) en JSON y CSV.

## Contexto extra
Depende de la Fase 3 (sesiones y overrides). Si no existen sesiones aún, exporta solo el dataset global y deja el parámetro `?session=` preparado.
El formato JSON de exportación debe ser **el mismo que aceptan los seeds** (`backend/data/*.json`), para que exportar e importar sea simétrico.

## Entregable
1. `backend/routes/export.js`:
   - `GET /api/export/json?session=<id>` → un único JSON con `{ types, type_chart, pokemon, moves, abilities }`.
   - `GET /api/export/csv?entity=pokemon|moves|abilities|types&session=<id>` → CSV con cabecera, un archivo por entidad.
   - Cabecera `Content-Disposition: attachment` con nombre de archivo con fecha (`pamudex-<sesion>-<fecha>.json`).
2. Montar en `server.js`.
3. `frontend/src/pages/ImportExport.tsx` en `/datos` — botones de descarga por formato y por entidad, con selector de sesión.
4. Claves i18n `data.*`.

## Criterios de aceptación
- [ ] El JSON exportado, colocado en `backend/data/` y ejecutando `npm run seed`, reproduce la misma base de datos.
- [ ] Los CSV se abren correctamente en LibreOffice/Excel (campos con comas escapados entre comillas).
- [ ] La descarga funciona desde el navegador del móvil.

## Fuera de alcance
Exportar SQLite (4.2) e importar (4.3, 4.4).
