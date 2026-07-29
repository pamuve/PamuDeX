import { PokemonDetail, MoveSummary, TeamSlot, RivalSlot, Recommendation, CandidateScore, Reason } from "../types";
import { estimateDamage, bestMoveAgainst } from "./damage";

const DANGER_THRESHOLD = 50; // % de PS a partir del cual un movimiento rival se marca como "peligro"
const HIT_HARD_THRESHOLD = 50; // % de PS a partir del cual un golpe propio se destaca como "puede debilitar con..."

export function bestResponseAgainst(
  rival: RivalSlot,
  rivalPokemon: PokemonDetail,
  ownTeam: TeamSlot[],
  ownPokemonById: Record<number, PokemonDetail>,
  movesById: Record<number, MoveSummary>
): Recommendation {
  const rivalMoveIds = [...rival.knownMoveIds, ...rival.suspectedMoveIds];
  const rivalMoves = rivalMoveIds.map((id) => movesById[id]).filter(Boolean) as MoveSummary[];

  const ranked: CandidateScore[] = ownTeam
    .map((slot): CandidateScore | null => {
      const ownPokemon = ownPokemonById[slot.pokemonId];
      if (!ownPokemon) return null;

      const ownMoves = slot.moveIds.map((id) => movesById[id]).filter(Boolean) as MoveSummary[];
      const bestOutgoing = bestMoveAgainst(ownPokemon, ownMoves, rivalPokemon);

      const incoming = rivalMoves.map((move) => ({ move, estimate: estimateDamage(rivalPokemon, move, ownPokemon) }));
      const worstIncoming = incoming.reduce<null | (typeof incoming)[number]>(
        (worst, cur) => (!worst || cur.estimate.percentOfHp > worst.estimate.percentOfHp ? cur : worst),
        null
      );

      const reasons: Reason[] = [];
      const dangers: Reason[] = [];
      const alreadyNoted = new Set<string>();

      incoming.forEach(({ move, estimate }) => {
        const dedupeKey = `${move.type_id}-${estimate.effectivenessMultiplier}`;
        if (estimate.effectivenessMultiplier === 0 && !alreadyNoted.has(dedupeKey)) {
          reasons.push({ type: "immune", moveName: move.name_es, typeName: move.type_id });
          alreadyNoted.add(dedupeKey);
        } else if (estimate.effectivenessMultiplier <= 0.5 && !alreadyNoted.has(dedupeKey)) {
          reasons.push({ type: "resists", moveName: move.name_es, typeName: move.type_id });
          alreadyNoted.add(dedupeKey);
        }
        if (estimate.percentOfHp >= DANGER_THRESHOLD) {
          dangers.push({ type: "danger_move", moveName: move.name_es, value: estimate.percentOfHp });
        }
      });

      if (bestOutgoing && bestOutgoing.percentOfHp >= HIT_HARD_THRESHOLD) {
        reasons.push({ type: "can_hit_hard", moveName: bestOutgoing.move.name_es, value: bestOutgoing.percentOfHp });
      }

      const isFaster = ownPokemon.stats.spe > rivalPokemon.stats.spe;
      if (isFaster) reasons.push({ type: "faster" });
      else if (ownPokemon.stats.spe < rivalPokemon.stats.spe) dangers.push({ type: "outsped" });

      const resistBonus = reasons.filter((r) => r.type === "resists" || r.type === "immune").length * 15;
      const speedBonus = isFaster ? 10 : -10;
      const score =
        (bestOutgoing?.percentOfHp ?? 0) - (worstIncoming?.estimate.percentOfHp ?? 0) + resistBonus + speedBonus;

      return { pokemonId: slot.pokemonId, score: Math.round(score * 10) / 10, reasons, dangers };
    })
    .filter((c): c is CandidateScore => c !== null)
    .sort((a, b) => b.score - a.score);

  return { rivalPokemonId: rivalPokemon.id, ranked };
}
