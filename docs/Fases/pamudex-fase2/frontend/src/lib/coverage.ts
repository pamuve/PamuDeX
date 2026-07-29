import { PokemonDetail, MoveSummary, TeamSlot, TypeDetail, CoverageReport } from "../types";

export function analyzeTeamCoverage(
  team: TeamSlot[],
  pokemonById: Record<number, PokemonDetail>,
  movesById: Record<number, MoveSummary>,
  typesById: Record<string, TypeDetail>
): CoverageReport {
  const members = team.map((s) => pokemonById[s.pokemonId]).filter(Boolean) as PokemonDetail[];
  const allTypeIds = Object.keys(typesById);

  function multiplierFor(pokemon: PokemonDetail, attackerType: string): number {
    const bucket = pokemon.efectividad.find((b) => b.types.includes(attackerType));
    return bucket ? bucket.multiplier : 1;
  }

  const globalWeakness: string[] = [];
  const noResist: string[] = [];
  const defensiveHotspots: string[] = [];

  if (members.length > 0) {
    allTypeIds.forEach((typeId) => {
      const multipliers = members.map((m) => multiplierFor(m, typeId));
      const weakCount = multipliers.filter((m) => m >= 2).length;
      const resistCount = multipliers.filter((m) => m <= 0.5).length;

      if (weakCount >= 2) globalWeakness.push(typeId);
      if (resistCount === 0) noResist.push(typeId);
      if (weakCount > members.length / 2) defensiveHotspots.push(typeId);
    });
  }

  // Tipos propios (defensivos/ofensivos del propio Pokémon) que se repiten 3 veces o más
  const typeCounts: Record<string, number> = {};
  members.forEach((m) => m.types.forEach((t) => (typeCounts[t.id] = (typeCounts[t.id] ?? 0) + 1)));
  const overrepresented = Object.entries(typeCounts)
    .filter(([, count]) => count >= 3)
    .map(([id]) => id);

  // Cobertura ofensiva: tipos defensores contra los que ningún movimiento del equipo llega al menos a x1
  const teamMoves = team.flatMap((s) => s.moveIds.map((id) => movesById[id]).filter(Boolean)) as MoveSummary[];
  const hitAtLeastNeutral = new Set<string>();
  teamMoves.forEach((move) => {
    const moveType = typesById[move.type_id];
    if (!moveType) return;
    moveType.ofensivo.forEach((bucket) => {
      if (bucket.multiplier >= 1) bucket.types.forEach((t) => hitAtLeastNeutral.add(t));
    });
  });
  const offensiveGaps = teamMoves.length > 0 ? allTypeIds.filter((t) => !hitAtLeastNeutral.has(t)) : [];

  return { globalWeakness, noResist, overrepresented, offensiveGaps, defensiveHotspots };
}
