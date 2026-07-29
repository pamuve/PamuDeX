import { PokemonDetail, MoveSummary, DamageEstimate } from "../types";

// Multiplicador de efectividad de un movimiento contra un Pokémon, a partir de su perfil
// defensivo ya calculado por el backend (PokemonDetail.efectividad).
function effectivenessAgainst(defender: PokemonDetail, moveTypeId: string): number {
  for (const bucket of defender.efectividad) {
    if (bucket.types.includes(moveTypeId)) return bucket.multiplier;
  }
  return 1; // el tipo no aparece en ningún bucket -> normal (x1)
}

// Nota: se usa el valor medio del rango de daño real de los juegos (85%-100% -> 92.5%)
// para simplificar. Nivel fijo en 50 para todos los cálculos de esta fase.
const LEVEL = 50;
const RANDOM_FACTOR = 0.925;

export function estimateDamage(attacker: PokemonDetail, move: MoveSummary, defender: PokemonDetail): DamageEstimate {
  if (move.category === "estado" || !move.power) {
    return { raw: 0, percentOfHp: 0, effectivenessMultiplier: effectivenessAgainst(defender, move.type_id), stab: false };
  }

  const isPhysical = move.category === "fisico";
  const atkStat = isPhysical ? attacker.stats.atk : attacker.stats.spa;
  const defStat = isPhysical ? defender.stats.def : defender.stats.spd;

  const stab = attacker.types.some((t) => t.id === move.type_id);
  const effectivenessMultiplier = effectivenessAgainst(defender, move.type_id);

  const baseDamage = (2 * LEVEL) / 5 + 2;
  const raw =
    ((baseDamage * move.power * (atkStat / Math.max(1, defStat))) / 50 + 2) *
    (stab ? 1.5 : 1) *
    effectivenessMultiplier *
    RANDOM_FACTOR;

  const percentOfHp = Math.min(100, (raw / Math.max(1, defender.stats.hp)) * 100);

  return { raw: Math.round(raw * 100) / 100, percentOfHp: Math.round(percentOfHp * 10) / 10, effectivenessMultiplier, stab };
}

export function bestMoveAgainst(
  attacker: PokemonDetail,
  attackerMoves: MoveSummary[],
  defender: PokemonDetail
): (DamageEstimate & { move: MoveSummary }) | null {
  if (attackerMoves.length === 0) return null;
  let best: (DamageEstimate & { move: MoveSummary }) | null = null;
  for (const move of attackerMoves) {
    const estimate = estimateDamage(attacker, move, defender);
    if (!best || estimate.raw > best.raw) best = { ...estimate, move };
  }
  return best;
}

/* Ejemplos de uso (comentados, no forman parte del build):
 *
 * const est = estimateDamage(pikachu, thunderbolt, gyarados);
 * // est.effectivenessMultiplier === 2 (Eléctrico contra Agua/Volador)
 * // est.stab === true (Pikachu es Eléctrico y el movimiento es Eléctrico)
 *
 * const best = bestMoveAgainst(pikachu, [thunderbolt, tackle], gyarados);
 * // best?.move.name_es === "Rayo"
 */
