# Tarea 8.4 — Rendimiento y auditoría

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Verificar y cumplir el requisito del proyecto: los datos ya almacenados localmente se muestran en **menos de 100 ms**, y la app funciona entera sin conexión tras la primera sincronización.

## Contexto extra
Hoy el frontend pide los datos a la API en cada carga y el service worker los cachea con `StaleWhileRevalidate` (configurado en `frontend/vite.config.ts`). Eso da tolerancia a fallos de red, pero no garantiza los 100 ms ni una experiencia offline completa desde el primer arranque.
El prompt original pide IndexedDB como caché de datos: aquí es donde toca implementarlo de verdad.

## Entregable
1. `frontend/src/lib/localCache.ts` — IndexedDB (`idb` o API nativa) que guarda el catálogo completo (tipos, Pokémon, movimientos, habilidades) tras la primera carga.
2. Estrategia de lectura: IndexedDB primero, red después para refrescar en segundo plano. La interfaz nunca debe esperar a la red si ya hay datos locales.
3. Sincronización explícita: botón "Descargar datos para uso offline" en `/ajustes`, con barra de progreso y fecha de la última sincronización.
4. Medición: instrumenta con `performance.now()` el tiempo desde la navegación hasta tener los datos pintados, y muéstralo en un modo de depuración accesible desde ajustes.
5. Auditoría Lighthouse (categoría PWA y rendimiento) y corrección de lo que salga; documenta los resultados en el README.

## Criterios de aceptación
- [ ] Con los datos ya descargados y en modo avión, la app abre y navega entre fichas sin errores.
- [ ] La medición confirma <100 ms para mostrar datos ya cacheados.
- [ ] Lighthouse marca la app como instalable y sin fallos críticos de PWA.

## Fuera de alcance
Optimizar el backend para grandes volúmenes (solo relevante si el dataset crece mucho).
