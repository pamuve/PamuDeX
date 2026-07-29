# Tarea 4.4 — Importar SQLite (fusionar o sustituir)

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Cargar un `.sqlite` externo, ya sea uno exportado por PamuDeX u otro con el mismo esquema.

## Contexto extra
Depende de 4.2 y 4.3 (reutiliza el flujo previsualizar → confirmar → aplicar).
Un `.sqlite` subido es **código ajeno en la práctica**: valida siempre el esquema antes de leer nada, y trabájalo en un archivo temporal abierto en modo solo lectura. No lo copies directamente sobre `backend/db/pamudex.sqlite`.

## Entregable
1. `POST /api/import/sqlite/preview` — abre el archivo subido en solo lectura, comprueba que las tablas y columnas requeridas existen, y devuelve el mismo tipo de resumen que 4.3.
2. `POST /api/import/sqlite/apply` con un modo: `merge` (fusiona con lo existente) o `replace` (sustituye el contenido de la sesión de destino).
3. UI: selector de modo con advertencia explícita para `replace` y confirmación adicional.
4. Límite de tamaño de subida razonable (por ejemplo 50 MB) y rechazo de archivos que no sean SQLite válidos.

## Criterios de aceptación
- [ ] Un archivo que no es SQLite se rechaza con mensaje claro, sin dejar temporales.
- [ ] Un SQLite con esquema incompatible se rechaza indicando qué tabla/columna falta.
- [ ] `replace` deja la sesión exactamente igual que el archivo importado; `merge` conserva lo que no colisiona.

## Fuera de alcance
Sincronización con servicios externos (Fase 9).
