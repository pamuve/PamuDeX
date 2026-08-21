import { Check, X } from "lucide-react";
import { Recommendation, PokemonDetail, MoveSummary, Reason } from "../types";
import { useI18n } from "../i18n";

const REASON_KEY: Partial<Record<Reason["type"], string>> = {
  resists: "recommendation.resists",
  immune: "recommendation.immune",
  can_hit_hard: "recommendation.can_hit_hard",
  faster: "recommendation.faster",
};
const DANGER_KEY: Partial<Record<Reason["type"], string>> = {
  danger_move: "recommendation.danger_move",
  outsped: "recommendation.outsped",
};

export function RecommendationCard({
  recommendation,
  rivalPokemon,
  pokemonById,
  movesById,
}: {
  recommendation: Recommendation;
  rivalPokemon: PokemonDetail;
  pokemonById: Record<number, PokemonDetail>;
  /** Para traducir el nombre del movimiento: `Reason` solo guarda su id. */
  movesById: Record<number, MoveSummary>;
}) {
  const { t, lang } = useI18n();
  const nombre = (o: { name_es: string; name_en: string }) =>
    lang === "en" ? o.name_en : o.name_es;
  /** El movimiento puede no estar en el catálogo si la sesión de ROM Hack lo
   *  quitó después de guardarlo en el equipo: mejor un hueco que reventar. */
  const nombreMovimiento = (id?: number) => {
    const m = id === undefined ? undefined : movesById[id];
    return m ? nombre(m) : "";
  };
  const top = recommendation.ranked[0];

  if (!top) {
    return (
      <div className="bg-panel rounded-xl2 p-4 shadow-card text-ink-soft text-sm">{t("recommendation.no_candidates")}</div>
    );
  }
  const recommended = pokemonById[top.pokemonId];

  return (
    <div className="bg-panel rounded-xl2 p-5 shadow-card animate-fadein space-y-3">
      <div className="text-ink-soft text-sm">{t("recommendation.against", { name: nombre(rivalPokemon) })}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-widest text-ink-soft">{t("recommendation.recommended")}</span>
        <span className="font-display text-lg font-bold text-ink">
          {recommended ? nombre(recommended) : "—"}
        </span>
      </div>

      {top.reasons.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-soft mb-1">{t("recommendation.reasons")}</div>
          <ul className="space-y-1">
            {top.reasons.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-ink">
                <Check size={14} className="text-[#78C850] shrink-0" />
                {t(REASON_KEY[r.type] ?? r.type, { move: nombreMovimiento(r.moveId), value: r.value ?? "" })}
              </li>
            ))}
          </ul>
        </div>
      )}

      {top.dangers.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-soft mb-1">{t("recommendation.dangers")}</div>
          <ul className="space-y-1">
            {top.dangers.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-ink">
                <X size={14} className="text-[#C03028] shrink-0" />
                {t(DANGER_KEY[r.type] ?? r.type, { move: nombreMovimiento(r.moveId), value: r.value ?? "" })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
