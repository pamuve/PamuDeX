# Tarea 4.3 — Importar JSON y CSV con previsualización

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Cargar datasets externos (por ejemplo, el volcado de un ROM Hack) validando el formato y **mostrando qué va a cambiar antes de aplicarlo**.

## Contexto extra
Depende de 4.1 (formato de exportación simétrico) y de la Fase 3 (para importar dentro de una sesión sin tocar los datos globales).
Nunca apliques una importación directamente: primero valida, luego muestra un resumen, y solo aplica si el usuario confirma.

## Entregable
1. `backend/lib/importValidator.js` — valida el JSON/CSV entrante contra el esquema esperado y devuelve `{ valid, errors[], summary: { added, updated, unchanged } }` por entidad.
2. `POST /api/import/preview` (multipart o body JSON) → devuelve la validación y el resumen, **sin escribir nada**.
3. `POST /api/import/apply` → aplica lo previsualizado a la sesión indicada (o al dataset global si se pide explícitamente).
4. UI en `frontend/src/pages/ImportExport.tsx`: subir archivo → tabla de previsualización con altas/modificaciones/errores → botón "Aplicar" (deshabilitado si hay errores bloqueantes).

## Criterios de aceptación
- [ ] Un JSON con un campo obligatorio ausente muestra un error claro y NO permite aplicar.
- [ ] La previsualización distingue correctamente entradas nuevas de entradas modificadas.
- [ ] Importar el JSON exportado en 4.1 da como resultado "0 cambios".

## Fuera de alcance
Importar SQLite (4.4).
