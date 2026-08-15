import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { AbilityDetail as AbilityDetailT } from "../types";
import { FavoriteButton } from "../components/FavoriteButton";
import { GenerationSelector, useGenerationView } from "../components/GenerationSelector";
import { ChangeTag } from "../components/ChangeTag";
import { ChangeHistory } from "../components/ChangeHistory";
import { makeChangeLine } from "../lib/generations";
import { NotAllowed } from "../components/NotAllowed";
import { useRecordVisit } from "../lib/history";
import { useI18n } from "../i18n";

export function AbilityDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const [ability, setAbility] = useState<AbilityDetailT | null>(null);
  // Generación que se está viendo; null = la actual (Fase 7).
  const [gen, setGen] = useGenerationView(id);
  // En modo Champions el backend responde 404 si la entidad no es legal.
  const [noPermitido, setNoPermitido] = useState(false);

  useEffect(() => {
    if (!id) return;
    setNoPermitido(false);
    // Ver PokemonDetail: descarta la respuesta de una generación ya no elegida.
    let cancelado = false;
    api.abilities
      .detail(id, gen)
      .then((a) => !cancelado && setAbility(a))
      .catch(() => !cancelado && setNoPermitido(true));
    return () => {
      cancelado = true;
    };
  }, [id, gen]);

  useRecordVisit("ability", ability ? ability.id : undefined);

  if (noPermitido) return <NotAllowed />;
  if (!ability) return <div className="max-w-2xl mx-auto px-4 py-10 text-ink-soft">Cargando...</div>;

  // Las etiquetas solo tienen sentido en «Todas las generaciones» (ver
  // PokemonDetail).
  const cambios = gen === null ? ability.generational_changes : undefined;

  const linea = makeChangeLine(
    t,
    (field) => (field === "effect_es" ? t("generations.field.effect") : field),
    (value) => String(value)
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-panel rounded-xl2 p-6 shadow-card animate-fadein">
        <div className="flex items-center gap-1 mb-2">
          <h1 className="font-display text-2xl font-bold text-ink">{ability.name_es}</h1>
          <FavoriteButton type="ability" entityRef={ability.id} />
        </div>
        <p className="text-ink-soft text-sm mb-1">{t("pokemon.generation")} {ability.generation ?? "—"}</p>
        <p className="text-ink text-sm mt-3">
          {ability.effect_es}
          <ChangeTag changes={cambios} field="effect_es" />
        </p>
      </div>

      <GenerationSelector
        visible={ability.has_generational_differences}
        value={gen}
        onChange={setGen}
      />

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

      <ChangeHistory changes={ability.generational_changes} line={linea} />
    </div>
  );
}
