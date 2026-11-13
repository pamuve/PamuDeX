/**
 * PamuDeX — Fase 9
 * Calculadora de daño. La fórmula está en `lib/calc.ts`; esto es el formulario.
 *
 * Los dos Pokémon se cargan con `api.pokemon.detail`, así que traen los stats y
 * la efectividad del modo activo (sesión de ROM Hack o Champions). Los
 * movimientos del atacante se limitan a los que aprende, salvo que el ROM Hack
 * permita cualquiera o se pida la lista entera.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { api } from "../lib/api";
import { NATURES } from "../lib/team";
import { useSessionOptions } from "../lib/sessionOptions";
import {
  calculate,
  realStat,
  EMPTY_EVS,
  MAX_EV,
  type AttackerItem,
  type DefenderItem,
  type Side,
  type Weather,
} from "../lib/calc";
import { AddPokemonBox } from "../components/AddPokemonBox";
import { PokemonSprite } from "../components/PokemonSprite";
import { TypeBadge } from "../components/TypeBadge";
import { useI18n } from "../i18n";
import type { MoveSummary, PokemonDetail, PokemonSummary, StatKey, Stats } from "../types";

interface Config {
  pokemonId: number | null;
  level: number;
  nature: string;
  evs: Stats;
  iv: number;
  stage: number;
}

const CONFIG: Config = { pokemonId: null, level: 50, nature: "Fuerte", evs: EMPTY_EVS, iv: 31, stage: 0 };
const INPUT =
  "min-h-[2.75rem] w-full rounded-lg bg-hover px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent";
const ATTACKER_ITEMS: AttackerItem[] = ["none", "choice", "lifeOrb", "expertBelt", "typeBoost"];
const DEFENDER_ITEMS: DefenderItem[] = ["none", "eviolite", "assaultVest"];
const WEATHERS: Weather[] = ["none", "sun", "rain"];
const STAGES = [6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6];

function limitar(valor: string, min: number, max: number): number {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
}

/** Carga la ficha de un Pokémon cuando cambia el id. */
function usePokemon(id: number | null): PokemonDetail | null {
  const [poke, setPoke] = useState<PokemonDetail | null>(null);
  useEffect(() => {
    setPoke(null);
    if (id === null) return;
    let cancelado = false;
    api.pokemon
      .detail(id)
      .then((d) => !cancelado && setPoke(d))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [id]);
  return poke;
}

function SidePanel({
  title,
  config,
  onChange,
  pokemon,
  allPokemon,
  evStats,
  children,
}: {
  title: string;
  config: Config;
  onChange: (next: Config) => void;
  pokemon: PokemonDetail | null;
  allPokemon: PokemonSummary[];
  /** Las stats cuyos EVs influyen en este lado. */
  evStats: StatKey[];
  children?: React.ReactNode;
}) {
  const { t, name } = useI18n();
  const side: Side | null = pokemon ? { pokemon, ...config } : null;

  return (
    <section className="card space-y-3">
      <h2 className="section-title">{title}</h2>

      <AddPokemonBox
        allPokemon={allPokemon}
        disabled={false}
        label={t("calc.choose", { side: title })}
        placeholder={t("team.search_placeholder")}
        onAdd={(_dex, id) => onChange({ ...config, pokemonId: id })}
      />

      {config.pokemonId !== null && !pokemon && <p className="text-sm text-ink-soft">{t("common.loading")}</p>}

      {pokemon && side && (
        <>
          <div className="flex items-center gap-3">
            <PokemonSprite dex={pokemon.dex} nombre={name(pokemon)} className="h-14 w-14 shrink-0" />
            <div className="min-w-0 space-y-1">
              <div className="break-words font-display font-semibold text-ink">{name(pokemon)}</div>
              <div className="flex flex-wrap gap-1">
                {pokemon.types.map((tp) => (
                  <TypeBadge key={tp.id} type={tp} size="sm" />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1 text-xs text-ink-soft">
              {t("calc.level")}
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={config.level}
                onChange={(e) => onChange({ ...config, level: limitar(e.target.value, 1, 100) })}
                className={INPUT}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-soft">
              {t("calc.iv")}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={31}
                value={config.iv}
                onChange={(e) => onChange({ ...config, iv: limitar(e.target.value, 0, 31) })}
                className={INPUT}
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs text-ink-soft">
              {t("team.nature")}
              <select
                value={config.nature}
                onChange={(e) => onChange({ ...config, nature: e.target.value })}
                className={INPUT}
              >
                {NATURES.map((n) => (
                  <option key={n.name_es} value={n.name_es}>
                    {name(n)}
                    {n.boosts && n.hinders ? ` (+${t(`stat.${n.boosts}`)} −${t(`stat.${n.hinders}`)})` : ""}
                  </option>
                ))}
              </select>
            </label>

            {evStats.map((stat) => (
              <label key={stat} className="flex flex-col gap-1 text-xs text-ink-soft">
                <span className="flex justify-between gap-2">
                  {t("calc.evs", { stat: t(`stat.${stat}`) })}
                  <span className="font-mono text-ink tabular-nums">{realStat(side, stat)}</span>
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_EV}
                  step={4}
                  value={config.evs[stat]}
                  onChange={(e) =>
                    onChange({ ...config, evs: { ...config.evs, [stat]: limitar(e.target.value, 0, MAX_EV) } })
                  }
                  className={INPUT}
                />
              </label>
            ))}

            <label className="flex flex-col gap-1 text-xs text-ink-soft">
              {t("calc.stage")}
              <select
                value={config.stage}
                onChange={(e) => onChange({ ...config, stage: Number(e.target.value) })}
                className={INPUT}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s > 0 ? `+${s}` : s}
                  </option>
                ))}
              </select>
            </label>
            {children}
          </div>
        </>
      )}
    </section>
  );
}

export default function Calculator() {
  const { t, name } = useI18n();
  const options = useSessionOptions();
  const [allPokemon, setAllPokemon] = useState<PokemonSummary[]>([]);
  const [allMoves, setAllMoves] = useState<MoveSummary[]>([]);
  const [atk, setAtk] = useState<Config>(CONFIG);
  const [def, setDef] = useState<Config>(CONFIG);
  const [atkItem, setAtkItem] = useState<AttackerItem>("none");
  const [defItem, setDefItem] = useState<DefenderItem>("none");
  const [moveId, setMoveId] = useState<number | null>(null);
  const [todos, setTodos] = useState(false);
  const [learnable, setLearnable] = useState<Set<number> | null>(null);
  const [weather, setWeather] = useState<Weather>("none");
  const [critical, setCritical] = useState(false);
  const [burned, setBurned] = useState(false);
  const [screen, setScreen] = useState(false);

  const attacker = usePokemon(atk.pokemonId);
  const defender = usePokemon(def.pokemonId);

  useEffect(() => {
    api.pokemon.list().then(setAllPokemon).catch(() => {});
    api.moves.list().then(setAllMoves).catch(() => {});
  }, []);

  // Lo que aprende el atacante. Si no se puede pedir, se ofrece la lista entera.
  useEffect(() => {
    setLearnable(null);
    if (atk.pokemonId === null) return;
    let cancelado = false;
    api.extra
      .pokemon(atk.pokemonId)
      .then((d) => !cancelado && setLearnable(new Set(d.moves.map((m) => m.move_id))))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [atk.pokemonId]);

  const sinFiltro = todos || Boolean(options.any_move) || !learnable || learnable.size === 0;
  const movimientos = useMemo(
    () =>
      allMoves
        .filter((m) => m.category !== "estado" && m.power)
        .filter((m) => sinFiltro || learnable!.has(m.id))
        .slice()
        .sort((a, b) => name(a).localeCompare(name(b))),
    [allMoves, sinFiltro, learnable, name]
  );
  const move = movimientos.find((m) => m.id === moveId) || null;

  const resultado = useMemo(() => {
    if (!attacker || !defender || !move) return null;
    return calculate({
      attacker: { pokemon: attacker, ...atk, item: atkItem },
      defender: { pokemon: defender, ...def, item: defItem },
      move,
      weather,
      critical,
      burned,
      screen,
    });
  }, [attacker, defender, move, atk, def, atkItem, defItem, weather, critical, burned, screen]);

  function intercambiar() {
    setAtk(def);
    setDef(atk);
    setMoveId(null);
  }

  const fisico = move ? move.category === "fisico" : null;
  const resumen = (() => {
    if (!resultado || !move) return "";
    if (resultado.effectiveness === 0) return t("calc.immune");
    const ko =
      resultado.hitsWorst === resultado.hitsBest
        ? t("calc.koSure", { n: resultado.hitsWorst })
        : t("calc.koRange", { best: resultado.hitsBest, worst: resultado.hitsWorst });
    return `${resultado.min}–${resultado.max} (${resultado.minPercent}%–${resultado.maxPercent}%). ${ko}`;
  })();

  const casilla = (checked: boolean, set: (v: boolean) => void, clave: string) => (
    <label className="flex min-h-[2.75rem] items-center gap-2.5 rounded-lg bg-hover px-3 text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
      {t(clave)}
    </label>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-4 sm:space-y-6">
      <div className="space-y-1.5">
        <h1 className="page-title">{t("calc.title")}</h1>
        <p className="max-w-prose text-sm text-ink-soft">{t("calc.hint")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SidePanel
          title={t("calc.attacker")}
          config={atk}
          onChange={(c) => {
            if (c.pokemonId !== atk.pokemonId) setMoveId(null);
            setAtk(c);
          }}
          pokemon={attacker}
          allPokemon={allPokemon}
          evStats={fisico === false ? ["spa"] : fisico === true ? ["atk"] : ["atk", "spa"]}
        >
          <label className="flex flex-col gap-1 text-xs text-ink-soft">
            {t("team.item")}
            <select value={atkItem} onChange={(e) => setAtkItem(e.target.value as AttackerItem)} className={INPUT}>
              {ATTACKER_ITEMS.map((i) => (
                <option key={i} value={i}>
                  {t(`calc.item.${i}`)}
                </option>
              ))}
            </select>
          </label>
        </SidePanel>

        <SidePanel
          title={t("calc.defender")}
          config={def}
          onChange={setDef}
          pokemon={defender}
          allPokemon={allPokemon}
          evStats={fisico === false ? ["hp", "spd"] : fisico === true ? ["hp", "def"] : ["hp", "def", "spd"]}
        >
          <label className="flex flex-col gap-1 text-xs text-ink-soft">
            {t("team.item")}
            <select value={defItem} onChange={(e) => setDefItem(e.target.value as DefenderItem)} className={INPUT}>
              {DEFENDER_ITEMS.map((i) => (
                <option key={i} value={i}>
                  {t(`calc.item.${i}`)}
                </option>
              ))}
            </select>
          </label>
        </SidePanel>
      </div>

      <div className="flex justify-center">
        <button type="button" onClick={intercambiar} className="btn-secondary" disabled={!attacker && !defender}>
          <ArrowLeftRight size={16} aria-hidden="true" />
          {t("calc.swap")}
        </button>
      </div>

      <section className="card space-y-3">
        <h2 className="section-title">{t("calc.moveAndField")}</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-ink-soft sm:col-span-2">
            {t("calc.move")}
            <select
              value={moveId ?? ""}
              onChange={(e) => setMoveId(e.target.value ? Number(e.target.value) : null)}
              disabled={!attacker}
              className={INPUT}
            >
              <option value="">{attacker ? t("calc.chooseMove") : t("calc.chooseAttackerFirst")}</option>
              {movimientos.map((m) => (
                <option key={m.id} value={m.id}>
                  {name(m)} · {t(`category.${m.category}`)} · {m.power}
                </option>
              ))}
            </select>
          </label>
          {!options.any_move && casilla(todos, setTodos, "team.allMoves")}
          <label className="flex flex-col gap-1 text-xs text-ink-soft">
            {t("calc.weather")}
            <select value={weather} onChange={(e) => setWeather(e.target.value as Weather)} className={INPUT}>
              {WEATHERS.map((w) => (
                <option key={w} value={w}>
                  {t(`calc.weather.${w}`)}
                </option>
              ))}
            </select>
          </label>
          {casilla(critical, setCritical, "calc.critical")}
          {casilla(burned, setBurned, "calc.burned")}
          {casilla(screen, setScreen, "calc.screen")}
        </div>
      </section>

      <section className="card space-y-2" aria-labelledby="calc-resultado">
        <h2 id="calc-resultado" className="section-title">
          {t("calc.result")}
        </h2>
        {!resultado || !move || !defender ? (
          <p className="text-sm text-ink-soft">{t("calc.empty")}</p>
        ) : resultado.effectiveness === 0 ? (
          <p className="text-ink">{t("calc.immune")}</p>
        ) : (
          <>
            <p className="font-display text-2xl font-bold text-ink tabular-nums sm:text-3xl">
              {resultado.minPercent}% – {resultado.maxPercent}%
            </p>
            <p className="text-sm text-ink-soft tabular-nums">
              {t("calc.damageOf", { min: resultado.min, max: resultado.max, hp: resultado.hp })}
            </p>
            {/* Barra de PS que quedan tras un golpe: la franja clara es la
                diferencia entre el peor y el mejor resultado. */}
            <div className="relative h-3 overflow-hidden rounded-full bg-hover" aria-hidden="true">
              <div
                className="absolute inset-y-0 left-0 bg-success/40"
                style={{ width: `${Math.max(0, 100 - resultado.minPercent)}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-success"
                style={{ width: `${Math.max(0, 100 - resultado.maxPercent)}%` }}
              />
            </div>
            <p className="text-sm font-medium text-ink">
              {resultado.hitsWorst === resultado.hitsBest
                ? t("calc.koSure", { n: resultado.hitsWorst })
                : t("calc.koRange", { best: resultado.hitsBest, worst: resultado.hitsWorst })}
            </p>
            <p className="text-xs text-ink-soft">
              {t("calc.effectiveness", { n: resultado.effectiveness })}
              {resultado.stab ? ` · ${t("calc.stab")}` : ""}
            </p>
          </>
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {resumen}
        </span>
        <p className="pt-1 text-xs text-ink-soft">{t("calc.limits")}</p>
      </section>
    </div>
  );
}
