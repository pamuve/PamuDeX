# Tarea 2.4 — Analizador "Mejor respuesta"

## 1. Resumen del proyecto

PamuDeX es una PWA autoalojada y offline-first para consultar tipos, Pokémon, movimientos y habilidades. Stack: **React + TypeScript + Vite + TailwindCSS** (frontend) · **Node.js + Express + SQLite** (backend).

## 2. Contexto mínimo necesario

Depende de las tareas 2.1, 2.2 y 2.3. Necesitas adjuntar (o pegar) estos archivos ya generados:

- `frontend/src/lib/team.ts` (equipo propio y rival)
- `frontend/src/lib/damage.ts` (tarea 2.3): `estimateDamage`, `bestMoveAgainst`
- `backend/lib/effectiveness.js` / su equivalente de efectividad ya usado en el frontend vía `/api/pokemon/:id` → campo `efectividad`.
- `frontend/src/types.ts`: `Team`, `TeamSlot`, `RivalSlot`, `PokemonDetail`.

## 3. Convenciones

- Paleta OLED, `rounded-xl2 shadow-card bg-panel`, i18n con `useI18n().t(...)`.
- El formato de salida debe respetar **exactamente** el estilo pedido en el prompt original del proyecto:

```
Contra Garchomp
Recomendado: Azumarill
Motivos:
✓ resiste Terremoto
✓ resiste Enfado
✓ puede debilitar con Carámbano
Peligros:
✗ Cabeza de Hierro
```

- Usa ✓ y ✗ literalmente como caracteres (no iconos SVG) para que coincida con el prompt original, o sustitúyelos por `lucide-react` (`Check`, `X`) si visualmente encaja mejor con el resto de la UI — decisión libre, pero mantén la estructura Motivos/Peligros.

## 4. Entregable exacto

1. `frontend/src/lib/recommendation.ts` con una función `bestResponseAgainst(rival: RivalSlot, rivalPokemon: PokemonDetail, ownTeam: TeamSlot[], ownPokemonById: Record<number, PokemonDetail>): Recommendation` que:
   - Para cada Pokémon propio, calcula cuánto daño recibiría del rival (usando `estimateDamage` con los movimientos conocidos + sospechados del rival) y cuánto daño podría infligir (con `bestMoveAgainst`).
   - Puntúa cada candidato propio combinando: menor daño esperado recibido, mayor daño que puede infligir, y si resiste (multiplicador ≤ 0.5) los movimientos conocidos del rival.
   - Devuelve el mejor candidato junto con una lista de motivos (✓) y peligros (✗) en texto ya traducible (usa claves i18n, no texto fijo en español dentro de la lógica).
2. `frontend/src/components/RecommendationCard.tsx` — tarjeta visual con el formato de arriba.
3. Integrar la recomendación en la página `/equipo`: por cada rival, mostrar la tarjeta de recomendación.

## 5. Archivos a crear/modificar

- `frontend/src/lib/recommendation.ts`
- `frontend/src/components/RecommendationCard.tsx`
- `frontend/src/pages/TeamBuilder.tsx` — añadir la sección de recomendaciones
- `frontend/src/i18n/es.json` / `en.json` — claves `recommendation.recommended`, `recommendation.reasons`, `recommendation.dangers`, `recommendation.resists`, `recommendation.can_ko_with`

## 6. Criterios de aceptación

- [ ] Si un Pokémon propio resiste todos los movimientos conocidos del rival y puede hacerle daño relevante, es recomendado por encima de uno que no resiste nada.
- [ ] La tarjeta muestra al menos un motivo (✓) cuando hay uno aplicable, y al menos un peligro (✗) si el rival tiene algún movimiento que hace más del 50% de daño estimado.
- [ ] `npm run build` sin errores de TypeScript.

## 7. Fuera de alcance

- Mapa de cobertura del equipo completo (tarea 2.5, es un análisis agregado, no por enfrentamiento 1 contra 1).
- Simulación de combate turno a turno (Fase 9).
