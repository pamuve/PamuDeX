# Tarea 2.2 — Panel "Equipo rival"

## 1. Resumen del proyecto

PamuDeX es una PWA autoalojada y offline-first para consultar tipos, Pokémon, movimientos y habilidades, con arquitectura preparada para comparador de equipos, sesiones ROM Hack, editor visual, perfiles multiusuario y modo Champions.
Stack: **React + TypeScript + Vite + TailwindCSS** (frontend) · **Node.js + Express + SQLite/better-sqlite3** (backend).

## 2. Contexto mínimo necesario

Esta tarea depende de la 2.1 (`docs/tasks/fase2/02-01-modelo-equipos.md`), que ya debería haber creado:

- `frontend/src/types.ts` con `Team`, `TeamSlot`, `Nature`.
- `frontend/src/lib/team.ts` con `loadTeam()` / `saveTeam()`.
- `frontend/src/components/TeamSlotCard.tsx`.
- La página `frontend/src/pages/TeamBuilder.tsx` en la ruta `/equipo`.

Adjunta esos 4 archivos a la conversación si los tienes ya generados; si no, pega aquí su contenido antes de pedir el código.

Diferencia clave con el equipo propio: el rival casi nunca se conoce al 100%, así que hay que poder marcar movimientos como **"sospechado"** en vez de confirmado.

## 3. Convenciones

- Mismas de siempre: paleta OLED, `rounded-xl2 shadow-card bg-panel`, i18n con `useI18n().t(...)`, persistencia en `localStorage` (clave `pamudex_team_rival`).
- Reutiliza `TeamSlotCard` si es razonable, o créate una variante `RivalSlotCard` — decide tú cuál genera menos duplicación.

## 4. Entregable exacto

Ampliar la página `/equipo` (o crear `/equipo/rival` si prefieres separarlo, tú decides y lo documentas) para añadir un panel "Equipo rival" con:

1. Hasta 6 Pokémon rivales.
2. Por cada uno: habilidad (desplegable de las reales del Pokémon), objeto (texto libre), movimientos conocidos (confirmados) y movimientos sospechados (opcional, visualmente diferenciados — por ejemplo con un badge o borde punteado).
3. Persistencia en `localStorage` bajo `pamudex_team_rival`, independiente del equipo propio.

## 5. Archivos a crear/modificar

- `frontend/src/types.ts` — añadir `RivalSlot` (como `TeamSlot` pero con `known_moves` y `suspected_moves` en vez de `moves`).
- `frontend/src/lib/team.ts` — añadir `loadRivalTeam()` / `saveRivalTeam()`.
- `frontend/src/components/RivalSlotCard.tsx`.
- `frontend/src/pages/TeamBuilder.tsx` — modificar para incluir el panel rival junto al propio (dos columnas en pantallas anchas, apiladas en móvil).
- `frontend/src/i18n/es.json` / `en.json` — claves nuevas (`team.rival`, `team.known_moves`, `team.suspected_moves`, etc.).

## 6. Criterios de aceptación

- [ ] El equipo rival persiste de forma independiente del equipo propio.
- [ ] Un movimiento sospechado se distingue visualmente de uno confirmado.
- [ ] `npm run build` sin errores de TypeScript.

## 7. Fuera de alcance

- Cálculo de daño (2.3), recomendaciones de "mejor respuesta" (2.4), mapa de cobertura (2.5).
