import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { AbilityDetail as AbilityDetailT } from "../types";
import { FavoriteButton } from "../components/FavoriteButton";
import { GenerationSelector, useGenerationView } from "../components/GenerationSelector";
import { ChangeTag } from "../components/ChangeTag";
import { ChangeHistory } from "../components/ChangeHistory";
import { makeChangeLine } from "../lib/generations";
import { DetailError, Loading } from "../components/PageState";
import { useDetail } from "../hooks/useDetail";
import { useRecordVisit } from "../lib/history";
import { BackLink } from "../components/BackLink";
import { useI18n } from "../i18n";

export function AbilityDetail() {
  const { id } = useParams();
  const { t, name } = useI18n();
  // Generación que se está viendo; null = la actual (Fase 7).
  const [gen, setGen] = useGenerationView(id);
  const { data: ability, fallo, reintentar } = useDetail<AbilityDetailT>(
    () => api.abilities.detail(id!, gen),
    [id, gen]
  );

  useRecordVisit("ability", ability ? ability.id : undefined);

  if (fallo) return <DetailError fallo={fallo} onRetry={reintentar} />;
  if (!ability) return <Loading />;

  // Las etiquetas solo tienen sentido en «Todas las generaciones» (ver
  // PokemonDetail).
  const cambios = gen === null ? ability.generational_changes : undefined;

  const linea = makeChangeLine(
    t,
    (field) => (field === "effect_es" ? t("generations.field.effect") : field),
    (value) => String(value)
  );

  return (
    <div className="max-w-2xl mx-auto px-4 pt-2 pb-6 sm:pt-4 sm:pb-8 space-y-4 sm:space-y-6">
      <BackLink />
      <section className="card animate-fadein">
        <div className="flex items-center gap-1 mb-2">
          <h1 className="font-display text-2xl font-bold text-ink min-w-0 break-words">{name(ability)}</h1>
          <FavoriteButton type="ability" entityRef={ability.id} />
        </div>
        <p className="text-ink-soft text-sm mb-1">{t("pokemon.generation")} {ability.generation ?? "—"}</p>
        <p className="text-ink text-sm mt-3 max-w-prose">
          {ability.effect_es}
          <ChangeTag changes={cambios} field="effect_es" />
        </p>
      </section>

      <GenerationSelector
        visible={ability.has_generational_differences}
        value={gen}
        onChange={setGen}
      />

      <section className="card animate-fadein">
        <h2 className="section-title mb-3">{t("ability.pokemonWith")}</h2>
        <div className="flex flex-wrap gap-2">
          {ability.pokemon.map((p) => (
            <Link
              key={p.id}
              to={`/pokemon/${p.id}`}
              className="pressable inline-flex items-center gap-1 min-h-[2.25rem] px-3 rounded-lg bg-hover text-ink text-sm hover:brightness-125"
            >
              {name(p)}
              {p.is_hidden ? <span className="text-ink-soft text-xs">({t("ability.hiddenShort")})</span> : null}
            </Link>
          ))}
          {ability.pokemon.length === 0 && <span className="text-ink-soft text-sm">{t("empty.results")}</span>}
        </div>
      </section>

      <ChangeHistory changes={ability.generational_changes} line={linea} />
    </div>
  );
}
