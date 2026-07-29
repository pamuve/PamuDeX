# Tarea 9.2 — Simulador de combate

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.
> **Tarea grande**: divídela en las cuatro subtareas de abajo, una por conversación.

## Objetivo
Simular combates turno a turno entre el equipo propio y el rival.

## Contexto extra
Depende de 9.1 (necesitas daño fiel antes de simular nada).
Consejo de arquitectura: el motor debe ser una **máquina de estados pura** (estado + acción → nuevo estado), sin nada de React dentro. Así se puede probar, repetir con la misma semilla y reutilizar.

## Subtareas
- **9.2.a — Motor de estado**: `BattleState` (equipos, PS, estados alterados, cambios de estadística, clima, turno) y `applyAction(state, action)`. Sin interfaz.
- **9.2.b — Orden de turno y efectos**: prioridad de movimiento, velocidad, empates, efectos de fin de turno (veneno, quemadura, clima), condiciones de derrota/cambio forzado.
- **9.2.c — Interfaz de combate**: página `/combate` con el campo, PS, registro de acciones y selección de movimiento/cambio.
- **9.2.d — Rival automático**: una IA sencilla y explicable (elige el movimiento de mayor daño esperado, cambia si va a caer) — deliberadamente simple, no un rival competitivo.

## Criterios de aceptación
- [ ] Con la misma semilla aleatoria, la misma secuencia de acciones da siempre el mismo resultado.
- [ ] El registro de combate explica cada turno de forma legible.

## Fuera de alcance
Combates dobles, movimientos Z, Dinamax, Teracristalización (apuntar como ampliación posterior).
