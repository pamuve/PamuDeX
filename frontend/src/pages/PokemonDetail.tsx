import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, esFalloDeRed } from "../lib/api";
import { PokemonDetail as PokemonDetailT, PokeType } from "../types";
import { TypeBadge } from "../components/TypeBadge";
import { EffectivenessPanel } from "../components/EffectivenessPanel";
import { FavoriteButton } from "../components/FavoriteButton";
import { PokemonSprite } from "../components/PokemonSprite";
import { GenerationSelector, useGenerationView } from "../components/GenerationSelector";
import { ChangeTag } from "../components/ChangeTag";
import { ChangeHistory } from "../components/ChangeHistory";
import { makeChangeLine } from "../lib/generations";
import { NotAllowed } from "../components/NotAllowed";
import { LoadError } from "../components/LoadError";
import { useRecordVisit } from "../lib/history";
import { useI18n } from "../i18n";

const STAT_LABEL: Record<string, string> = { hp: "PS", atk: "Ataque", def: "Defensa", spa: "At. Esp.", spd: "Def. Esp.", spe: "Velocidad" };
const STAT_MAX = 180;

export function PokemonDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const [poke, setPoke] = useState<PokemonDetailT | null>(null);
  const [typesById, setTypesById] = useState<Record<string, PokeType>>({});
  // Generación que se está viendo; null = la actual (Fase 7).
  const [gen, setGen] = useGenerationView(id);
  // En modo Champions el backend responde 404 si la entidad no es legal.
  const [noPermitido, setNoPermitido] = useState(false);
  // Fallo de red, que NO es lo mismo (8.4): antes cualquier error acababa en
  // «no permitida en Champions», y sin cobertura eso era mentira.
  const [sinRed, setSinRed] = useState(false);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    if (!id) return;
    setNoPermitido(false);
    setSinRed(false);
    // `cancelado` descarta la respuesta de una generación que ya no es la
    // elegida: pulsar rápido varias deja peticiones en vuelo que pueden
    // resolverse en otro orden.
    let cancelado = false;
    api.pokemon
      .detail(id, gen)
      .then((p) => !cancelado && setPoke(p))
      .catch((err) => {
        if (cancelado) return;
        if (esFalloDeRed(err)) setSinRed(true);
        else setNoPermitido(true);
      });
    return () => {
      cancelado = true;
    };
  }, [id, gen, reintento]);

  useEffect(() => {
    api.types.list().then((list) => setTypesById(Object.fromEntries(list.map((t) => [t.id, t]))));
  }, []);

  // Se anota el id interno, no el :id de la URL: la ruta acepta también el nº de
  // Pokédex, y el historial (como los favoritos) se indexa siempre por id.
  useRecordVisit("pokemon", poke ? poke.id : undefined);

  if (noPermitido) return <NotAllowed />;
  if (sinRed) return <LoadError offline onRetry={() => setReintento((n) => n + 1)} />;
  if (!poke) return <div className="max-w-3xl mx-auto px-4 py-10 text-ink-soft">{t("common.loading")}</div>;

  // Las etiquetas solo tienen sentido en «Todas las generaciones»: si se está
  // viendo una concreta, el dato de la ficha YA es el histórico.
  const cambios = gen === null ? poke.generational_changes : undefined;

  // Los tipos se guardan como ids; se traducen con el catálogo ya cargado.
  const nombresDeTipo = (value: unknown) =>
    Array.isArray(value)
      ? value.map((v) => typesById[String(v)]?.name_es ?? String(v)).join(" / ")
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
      if (field.startsWith("stats.")) return STAT_LABEL[field.slice(6)] ?? field;
      return field;
    },
    (value, change) => (change.field === "types" ? nombresDeTipo(value) : String(value))
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-panel rounded-xl2 p-6 shadow-card flex flex-col sm:flex-row gap-6 items-center animate-fadein">
        <div
          className="w-32 h-32 rounded-xl2 flex items-center justify-center text-5xl font-display font-bold shrink-0 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${poke.types[0]?.color}33, ${poke.types[poke.types.length - 1]?.color}33)` }}
        >
          <PokemonSprite dex={poke.dex} nombre={poke.name_es} className="w-24 h-24" />
        </div>
        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="text-ink-soft font-mono text-sm">#{String(poke.dex).padStart(3, "0")} · {t("pokemon.generation")} {poke.generation}</div>
          <div className="flex items-center gap-1 justify-center sm:justify-start">
            <h1 className="font-display text-2xl font-bold text-ink">{poke.name_es}</h1>
            <FavoriteButton type="pokemon" entityRef={poke.id} />
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
            {poke.types.map((tp) => (
              <TypeBadge key={tp.id} type={tp} />
            ))}
            <ChangeTag changes={cambios} field="types" format={nombresDeTipo} />
          </div>
          <div className="flex gap-4 text-sm text-ink-soft pt-1 justify-center sm:justify-start">
            <span>{t("pokemon.height")}: {poke.height_m} m</span>
            <span>{t("pokemon.weight")}: {poke.weight_kg} kg</span>
          </div>
        </div>
      </div>

      <GenerationSelector
        visible={poke.has_generational_differences}
        value={gen}
        onChange={setGen}
      />

      <div className="bg-panel rounded-xl2 p-6 shadow-card animate-fadein">
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-4">
          {t("pokemon.abilities")}
          <ChangeTag changes={cambios} field="abilities" />
          <ChangeTag changes={cambios} field="hidden_ability" />
        </h2>
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
              {/*
                `w-24` y sin envolver: la etiqueta de cambios ocupa ~22px y con
                el `w-20` de antes «Velocidad» se partía en dos líneas, que
                desalineaba esa barra respecto a las demás. El ancho es fijo e
                igual en todas las filas para que las barras arranquen a la
                misma altura, lleven etiqueta o no.
              */}
              <span className="w-24 shrink-0 flex items-center gap-0.5 text-sm text-ink-soft">
                {STAT_LABEL[key]}
                <ChangeTag changes={cambios} field={`stats.${key}`} />
              </span>
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

      <ChangeHistory changes={poke.generational_changes} line={linea} />
    </div>
  );
}
