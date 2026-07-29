# Tarea 8.1 — Modo alto contraste y escalado de texto

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Modo de alto contraste real y control de tamaño de texto, persistentes.

## Contexto extra
En `frontend/src/index.css` ya hay un esbozo de clase `.high-contrast`, pero es solo un marcador de posición: hay que implementarlo de verdad.
Si ya está hecha la tarea 3.5, los colores son variables CSS; reutilízalas en vez de duplicar valores.
Cuidado: el alto contraste puede usar negro puro si el usuario lo elige explícitamente por accesibilidad (ahí prima la legibilidad sobre la regla estética OLED), pero nunca por defecto.

## Entregable
1. Implementación real de `.high-contrast`: contraste mínimo 7:1 (AAA) en texto normal, bordes visibles en todas las tarjetas y controles.
2. Escalado de texto: 4 niveles (90%, 100%, 115%, 130%) aplicados con `font-size` en la raíz; comprueba que ningún layout se rompe al 130%.
3. `frontend/src/pages/Settings.tsx` en `/ajustes` — interruptores de alto contraste y escalado, con vista previa inmediata.
4. Persistencia en `localStorage` y, si existe perfil activo (Fase 5), también en `settings`.

## Criterios de aceptación
- [ ] Con alto contraste activo, todo el texto pasa una comprobación de contraste AAA.
- [ ] Al 130% de texto, ninguna tarjeta desborda ni corta contenido en una pantalla de 4".
- [ ] Los ajustes sobreviven a recargar y a reinstalar la PWA.

## Fuera de alcance
Lectores de pantalla y navegación por teclado (8.2).
