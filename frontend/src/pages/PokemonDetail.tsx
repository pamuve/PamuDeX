import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { PokemonDetail as PokemonDetailT, PokeType } from "../types";
import { TypeBadge } from "../components/TypeBadge";
import { EffectivenessPanel } from "../components/EffectivenessPanel";
import { useI18n } from "../i18n";

const STAT_LABEL: Record<string, string> = { hp: "PS", atk: "Ataque", def: "Defensa", spa: "At. Esp.", spd: "Def. Esp.", spe: "Velocidad" };
const STAT_MAX = 180;

export function PokemonDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const [poke, setPoke] = useState<PokemonDetailT | null>(null);
  const [typesById, setTypesById] = useState<Record<string, PokeType>>({});

  useEffect(() => {
    if (!id) return;
    api.pokemon.detail(id).then(setPoke);
    api.types.list().then((list) => setTypesById(Object.fromEntries(list.map((t) => [t.id, t]))));
  }, [id]);

  if (!poke) return <div className="max-w-3xl mx-auto px-4 py-10 text-ink-soft">Cargando...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-panel rounded-xl2 p-6 shadow-card flex flex-col sm:flex-row gap-6 items-center animate-fadein">
        <div
          className="w-32 h-32 rounded-xl2 flex items-center justify-center text-5xl font-display font-bold shrink-0"
          style={{ background: `linear-gradient(135deg, ${poke.types[0]?.color}33, ${poke.types[poke.types.length - 1]?.color}33)` }}
        >
          {poke.name_es[0]}
        </div>
        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="text-ink-soft font-mono text-sm">#{String(poke.dex).padStart(3, "0")} · {t("pokemon.generation")} {poke.generation}</div>
          <h1 className="font-display text-2xl font-bold text-ink">{poke.name_es}</h1>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {poke.types.map((tp) => (
              <TypeBadge key={tp.id} type={tp} />
            ))}
          </div>
          <div className="flex gap-4 text-sm text-ink-soft pt-1 justify-center sm:justify-start">
            <span>{t("pokemon.height")}: {poke.height_m} m</span>
            <span>{t("pokemon.weight")}: {poke.weight_kg} kg</span>
          </div>
        </div>
      </div>

      <div className="bg-panel rounded-xl2 p-6 shadow-card animate-fadein">
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-4">{t("pokemon.abilities")}</h2>
        <div className="space-y-2">
          {poke.abilities.map((a) => (
            <div key={a.name_es} className="flex flex-col">
              <span className="text-ink font-medium">{a.name_es}</span>
              <span className="text-ink-soft text-sm">{a.effect_es}</span>
            </div>
          ))}
          {poke.hidden_ability && (
            <div className="flex flex-col pt-2 border-t border-hover mt-2">
              <span className="text-ink font-medium">
                {poke.hidden_ability.name_es} <em className="text-ink-soft text-xs not-italic">({t("pokemon.hidden_ability")})</em>
              </span>
              <span className="text-ink-soft text-sm">{poke.hidden_ability.effect_es}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-panel rounded-xl2 p-6 shadow-card animate-fadein">
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-4">{t("pokemon.stats")}</h2>
        <div className="space-y-2.5">
          {Object.entries(poke.stats).map(([key, val]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-20 text-sm text-ink-soft">{STAT_LABEL[key]}</span>
              <div className="flex-1 h-2 bg-hover rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#6890F0]" style={{ width: `${Math.min(100, (val / STAT_MAX) * 100)}%` }} />
              </div>
              <span className="w-10 text-right font-mono text-sm text-ink">{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-4">{t("pokemon.weaknesses")}</h2>
        <EffectivenessPanel buckets={poke.efectividad} typesById={typesById} />
      </div>
    </div>
  );
}