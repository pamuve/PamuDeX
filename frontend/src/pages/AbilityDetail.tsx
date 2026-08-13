import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { AbilityDetail as AbilityDetailT } from "../types";
import { FavoriteButton } from "../components/FavoriteButton";
import { NotAllowed } from "../components/NotAllowed";
import { useRecordVisit } from "../lib/history";
import { useI18n } from "../i18n";

export function AbilityDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const [ability, setAbility] = useState<AbilityDetailT | null>(null);
  // En modo Champions el backend responde 404 si la entidad no es legal.
  const [noPermitido, setNoPermitido] = useState(false);

  useEffect(() => {
    if (!id) return;
    setNoPermitido(false);
    api.abilities.detail(id).then(setAbility).catch(() => setNoPermitido(true));
  }, [id]);

  useRecordVisit("ability", ability ? ability.id : undefined);

  if (noPermitido) return <NotAllowed />;
  if (!ability) return <div className="max-w-2xl mx-auto px-4 py-10 text-ink-soft">Cargando...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-panel rounded-xl2 p-6 shadow-card animate-fadein">
        <div className="flex items-center gap-1 mb-2">
          <h1 className="font-display text-2xl font-bold text-ink">{ability.name_es}</h1>
          <FavoriteButton type="ability" entityRef={ability.id} />
        </div>
        <p className="text-ink-soft text-sm mb-1">{t("pokemon.generation")} {ability.generation ?? "—"}</p>
        <p className="text-ink text-sm mt-3">{ability.effect_es}</p>
      </div>

      <div className="bg-panel rounded-xl2 p-6 shadow-card animate-fadein">
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-3">Pokémon con esta habilidad</h2>
        <div className="flex flex-wrap gap-2">
          {ability.pokemon.map((p) => (
            <Link
              key={p.id}
              to={`/pokemon/${p.id}`}
              className="px-3 py-1.5 rounded-lg bg-hover text-ink text-sm hover:bg-[#24406b] transition-colors"
            >
              {p.name_es} {p.is_hidden ? <em className="text-ink-soft not-italic text-xs">(oculta)</em> : null}
            </Link>
          ))}
          {ability.pokemon.length === 0 && <span className="text-ink-soft text-sm">{t("empty.results")}</span>}
        </div>
      </div>
    </div>
  );
}
