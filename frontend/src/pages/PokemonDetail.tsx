import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { PokemonDetail as PokemonDetailT, PokeType } from "../types";
import { TypeBadge } from "../components/TypeBadge";
import { EffectivenessPanel } from "../components/EffectivenessPanel";
import { FavoriteButton } from "../components/FavoriteButton";
import { PokemonSprite } from "../components/PokemonSprite";
import { GenerationSelector, useGenerationView } from "../components/GenerationSelector";
import { ChangeTag } from "../components/ChangeTag";
import { ChangeHistory } from "../components/ChangeHistory";
import { makeChangeLine } from "../lib/generations";
import { DetailError, Loading } from "../components/PageState";
import { useDetail } from "../hooks/useDetail";
import { useRecordVisit } from "../lib/history";
import { BackLink } from "../components/BackLink";
import { useI18n } from "../i18n";

const STAT_MAX = 180;

/**
 * Color de la barra según el valor, la escala que usa cualquier Pokédex: de un
 * vistazo se ve dónde destaca y dónde flojea. Antes todas eran del mismo azul y
 * la barra solo repetía el número que hay al lado.
 */
function colorDeStat(val: number): string {
  if (val < 60) return "bg-danger";
  if (val < 90) return "bg-warning";
  if (val < 120) return "bg-success";
  return "bg-accent";
}

export function PokemonDetail() {
  const { id } = useParams();
  const { t, name } = useI18n();
  const [typesById, setTypesById] = useState<Record<string, PokeType>>({});
  // Generación que se está viendo; null = la actual (Fase 7).
  const [gen, setGen] = useGenerationView(id);
  const { data: poke, fallo, reintentar } = useDetail(() => api.pokemon.detail(id!, gen), [id, gen]);

  useEffect(() => {
    // Solo da nombre a los tipos de las etiquetas de cambios: si falla, se
    // pintan con su id y la ficha sigue sirviendo.
    api.types
      .list()
      .then((list) => setTypesById(Object.fromEntries(list.map((t) => [t.id, t]))))
      .catch(() => {});
  }, []);

  // Se anota el id interno, no el :id de la URL: la ruta acepta también el nº de
  // Pokédex, y el historial (como los favoritos) se indexa siempre por id.
  useRecordVisit("pokemon", poke ? poke.id : undefined);

  if (fallo) return <DetailError fallo={fallo} onRetry={reintentar} />;
  if (!poke) return <Loading />;

  // Las etiquetas solo tienen sentido en «Todas las generaciones»: si se está
  // viendo una concreta, el dato de la ficha YA es el histórico.
  const cambios = gen === null ? poke.generational_changes : undefined;

  // Los tipos se guardan como ids; se traducen con el catálogo ya cargado.
  const nombresDeTipo = (value: unknown) =>
    Array.isArray(value)
      ? value.map((v) => (typesById[String(v)] ? name(typesById[String(v)]) : String(v))).join(" / ")
      : String(value);

  // La línea temporal reaprovecha el mismo formateador que las etiquetas; solo
  // añade cómo se llama cada campo. `stats.atk` sale como «Ataque», la misma
  // etiqueta que se ve arriba en la tabla de estadísticas.
  const linea = makeChangeLine(
    t,
    (field) => {
      if (field === "types") return t("generations.field.types");
      if (field === "abilities") return t("generations.field.abilities");
      if (field === "hidden_ability") return t("generations.field.hidden");
      if (field.startsWith("stats.")) return t(`stat.${field.slice(6)}`);
      return field;
    },
    (value, change) => (change.field === "types" ? nombresDeTipo(value) : String(value))
  );

  const total = Object.values(poke.stats).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-2 pb-6 sm:pt-4 sm:pb-8 space-y-4 sm:space-y-6">
      <BackLink />
      <section className="card flex flex-col sm:flex-row gap-5 sm:gap-6 items-center animate-fadein">
        <div
          className="w-32 h-32 rounded-xl2 flex items-center justify-center text-5xl font-display font-bold shrink-0 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${poke.types[0]?.color}33, ${poke.types[poke.types.length - 1]?.color}33)` }}
        >
          <PokemonSprite dex={poke.dex} nombre={name(poke)} className="w-24 h-24" />
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
          <div className="text-ink-soft font-mono text-sm tabular-nums">
            #{String(poke.dex).padStart(3, "0")} · {t("pokemon.generation")} {poke.generation}
          </div>
          <div className="flex items-center gap-1 justify-center sm:justify-start">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink break-words">{name(poke)}</h1>
            <FavoriteButton type="pokemon" entityRef={poke.id} />
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
            {poke.types.map((tp) => (
              <TypeBadge key={tp.id} type={tp} />
            ))}
            <ChangeTag changes={cambios} field="types" format={nombresDeTipo} />
          </div>
          <div className="flex gap-4 text-sm text-ink-soft pt-1 justify-center sm:justify-start tabular-nums">
            <span>{t("pokemon.height")}: <span className="text-ink">{poke.height_m} m</span></span>
            <span>{t("pokemon.weight")}: <span className="text-ink">{poke.weight_kg} kg</span></span>
          </div>
        </div>
      </section>

      <GenerationSelector
        visible={poke.has_generational_differences}
        value={gen}
        onChange={setGen}
      />

      {/* En escritorio, habilidades y estadísticas van lado a lado: son dos
          bloques cortos y apilados dejaban media pantalla vacía a la derecha. */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <section className="card animate-fadein">
          <h2 className="section-title mb-3">
            {t("pokemon.abilities")}
            <ChangeTag changes={cambios} field="abilities" />
            <ChangeTag changes={cambios} field="hidden_ability" />
          </h2>
          <div className="space-y-3">
            {poke.abilities.map((a) => (
              <div key={a.name_es} className="flex flex-col">
                <span className="text-ink font-medium">{name(a)}</span>
                <span className="text-ink-soft text-sm">{a.effect_es}</span>
              </div>
            ))}
            {poke.hidden_ability && (
              <div className="flex flex-col pt-3 border-t border-hover">
                <span className="text-ink font-medium">
                  {name(poke.hidden_ability)}{" "}
                  <span className="text-ink-soft text-xs">({t("pokemon.hidden_ability")})</span>
                </span>
                <span className="text-ink-soft text-sm">{poke.hidden_ability.effect_es}</span>
              </div>
            )}
          </div>
        </section>

        <section className="card animate-fadein">
          <h2 className="section-title mb-3">{t("pokemon.stats")}</h2>
          <dl className="space-y-2.5">
            {Object.entries(poke.stats).map(([key, val]) => (
              <div key={key} className="flex items-center gap-3">
                {/*
                  Ancho fijo e igual en todas las filas para que las barras
                  arranquen a la misma altura, lleven etiqueta de cambios o no.
                */}
                <dt className="w-24 shrink-0 flex items-center gap-0.5 text-sm text-ink-soft">
                  {t(`stat.${key}`)}
                  <ChangeTag changes={cambios} field={`stats.${key}`} />
                </dt>
                <dd className="contents">
                  <span className="w-9 text-right font-mono text-sm text-ink tabular-nums">{val}</span>
                  <span className="flex-1 h-2 bg-hover rounded-full overflow-hidden" aria-hidden="true">
                    <span
                      className={`block h-full rounded-full ${colorDeStat(val)}`}
                      style={{ width: `${Math.min(100, (val / STAT_MAX) * 100)}%` }}
                    />
                  </span>
                </dd>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-2.5 border-t border-hover">
              <dt className="w-24 shrink-0 text-sm font-semibold text-ink">{t("stat.total")}</dt>
              <dd className="w-9 text-right font-mono text-sm font-semibold text-ink tabular-nums">{total}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section>
        <h2 className="section-title mb-3">{t("pokemon.weaknesses")}</h2>
        <EffectivenessPanel buckets={poke.efectividad} typesById={typesById} />
      </section>

      <ChangeHistory changes={poke.generational_changes} line={linea} />
    </div>
  );
}
