# Tarea 3.5 — Colores y tema por sesión

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Que cada sesión pueda tener su propia identidad visual (útil para distinguir de un vistazo "Radical Red" de "Emerald Rogue"), **sin romper nunca la regla OLED de no usar negro puro**.

## Contexto extra
Depende de 3.1. Los colores del tema están hoy fijos en `tailwind.config.js`. Para hacerlos dinámicos hay que exponerlos como **variables CSS** en `src/index.css` (`--color-base`, `--color-panel`, `--color-hover`, `--color-ink`, `--color-ink-soft`) y hacer que Tailwind las consuma (`base: "var(--color-base)"`, etc.).

## Entregable
1. Refactor de `tailwind.config.js` + `src/index.css` para usar variables CSS con los valores actuales como predeterminados.
2. `frontend/src/lib/theme.ts` — `applyTheme(colors)` que escribe las variables en `document.documentElement`.
3. Sección "Tema" en el editor de sesión: 5 selectores de color con previsualización en vivo.
4. **Validación**: rechazar `#000000` y avisar al usuario de por qué (OLED friendly, evitar smearing).
5. Al cambiar de sesión activa, se aplica su tema automáticamente; sin sesión, los colores por defecto.

## Criterios de aceptación
- [ ] Cambiar el color de panel de una sesión repinta la interfaz al instante.
- [ ] Intentar poner negro puro muestra un aviso y no aplica el cambio.
- [ ] Volver a la sesión por defecto restaura la paleta original.
- [ ] `npm run build` sin errores.

## Fuera de alcance
Modo alto contraste (tarea 8.1) y sprites personalizados (Fase 9).
