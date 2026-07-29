# Tarea 2.3 — Motor de estimación de daño

## 1. Resumen del proyecto

PamuDeX es una PWA autoalojada y offline-first para consultar tipos, Pokémon, movimientos y habilidades. Stack: **React + TypeScript + Vite + TailwindCSS** (frontend) · **Node.js + Express + SQLite** (backend).

## 2. Contexto mínimo necesario

Ya existe y puedes reutilizar tal cual (pégalo o adjúntalo):

- `backend/lib/effectiveness.js` — dado un array de tipos defensores, devuelve el multiplicador de efectividad agrupado. Función clave: `defensiveProfile(defenderTypes: string[])`.
- `backend/data/type_chart.json` — matriz atacante→defensor→multiplicador (18 tipos, claves en minúscula sin tilde: `fuego`, `agua`, `electrico`, `planta`, `hielo`, `lucha`, `veneno`, `tierra`, `volador`, `psiquico`, `bicho`, `roca`, `fantasma`, `dragon`, `siniestro`, `acero`, `hada`, `normal`).
- `PokemonDetail.stats` = `{ hp, atk, def, spa, spd, spe }` (estadísticas base, 0-255 aprox).
- `MoveDetail` = `{ type_id, category: "fisico"|"especial"|"estado", power: number|null, ... }`.
- Tipos TS de equipo de la tarea 2.1 (`TeamSlot`, `Team`) y 2.2 (`RivalSlot`).

## 3. Convenciones

- Este motor **no necesita UI propia**: es una función pura de cálculo, reutilizable tanto en frontend (preview instantáneo) como en un futuro endpoint backend si hiciera falta. Escríbela en TypeScript puro sin dependencias de React.
- Nombra el resultado de forma clara: porcentaje de PS que quita un movimiento, no solo el número absoluto de daño.
- No implementes aleatoriedad del daño real de los juegos (rango 85%-100%) — usa el valor medio (92.5%) para simplificar; indícalo en un comentario.
- Fórmula de referencia (versión simplificada, sin objetos/clima/naturaleza en esta tarea — eso puede ampliarse después):

```
daño_base = ((2 * 50 / 5 + 2) * potencia_movimiento * (ataque / defensa) / 50 + 2)
daño_final = daño_base * STAB * efectividad_tipo * 0.925
```
donde `STAB = 1.5` si el movimiento comparte tipo con el atacante, si no `1`. `ataque`/`defensa` son las estadísticas base correspondientes según si el movimiento es físico o especial (`atk`/`def` o `spa`/`spd`). Nivel fijo en 50 para todos los cálculos (simplificación deliberada de esta fase).

## 4. Entregable exacto

Un módulo `frontend/src/lib/damage.ts` con:

1. `estimateDamage(attacker: PokemonDetail, move: MoveDetail, defender: PokemonDetail): DamageEstimate` — aplica la fórmula de arriba.
2. `DamageEstimate` = `{ raw: number; percentOfHp: number; effectivenessMultiplier: number; stab: boolean }`.
3. `bestMoveAgainst(attacker: PokemonDetail, attackerMoves: MoveDetail[], defender: PokemonDetail): DamageEstimate & { move: MoveDetail }` — de una lista de movimientos, cuál hace más daño.

## 5. Archivos a crear/modificar

- `frontend/src/lib/damage.ts` — todo lo anterior, con tests manuales comentados (ejemplos de uso al final del archivo, no hace falta un framework de testing todavía).

## 6. Criterios de aceptación

- [ ] `estimateDamage` con un movimiento super efectivo (x2) da un `percentOfHp` mayor que el mismo cálculo con multiplicador x1.
- [ ] Un movimiento del mismo tipo que el atacante aplica el STAB (x1.5).
- [ ] Un movimiento de categoría `"estado"` (sin `power`) devuelve `raw: 0` en vez de fallar o dar `NaN`.
- [ ] `npm run build` sin errores de TypeScript.

## 7. Fuera de alcance

- UI que muestre estos cálculos (eso lo usa la tarea 2.4).
- Objetos, clima, terreno, naturaleza, EVs/IVs, golpes críticos — quedan para la Fase 9 (calculadora de daño completa).
