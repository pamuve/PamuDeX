# Tarea 8.3 — Notificaciones opcionales e iconos definitivos

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Rematar la PWA: iconos propios y notificaciones opcionales (siempre desactivadas por defecto).

## Contexto extra
`frontend/public/icons/icon-192.png` y `icon-512.png` son marcadores de posición generados automáticamente (un cuadro con una "P") — hay que sustituirlos.
El manifiesto está en `frontend/vite.config.ts`, dentro de la configuración de `VitePWA`.
Nota importante: no uses arte oficial de Pokémon con copyright para los iconos de una app que vayas a distribuir; diseña algo propio.

## Entregable
1. Iconos definitivos: 192, 512 y 512 maskable (con zona de seguridad correcta), más `apple-touch-icon`. Genera también un `favicon.ico`.
2. Comprobar el manifiesto completo: nombre, nombre corto, descripción, `theme_color` `#0A1425`, `display: standalone`, orientación libre, `start_url`.
3. Notificaciones opcionales: interruptor en `/ajustes`, **desactivadas por defecto**, pidiendo permiso solo cuando el usuario las active (nunca al cargar la app).
4. Un caso de uso concreto y útil, no notificaciones por notificar: por ejemplo, avisar cuando hay una actualización de la app lista para aplicarse.
5. Manejar con elegancia el permiso denegado (explicar cómo revertirlo, no insistir).

## Criterios de aceptación
- [ ] Instalada en Android, el icono se ve correcto y recortado bien en la pantalla de inicio.
- [ ] La app nunca pide permiso de notificaciones por su cuenta.
- [ ] Con notificaciones bloqueadas, el resto de la app funciona igual.

## Fuera de alcance
Notificaciones push desde servidor (requiere infraestructura aparte).
