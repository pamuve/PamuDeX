/**
 * PamuDeX — Tarea 6.3
 * Página /champions: la portada del modo Pokémon Champions.
 *
 * AQUÍ NO SE FILTRA NADA
 * ----------------------
 * Esta página pide los datos con `api.*` igual que la portada normal. Lo que
 * cambia es que, con el modo activo, `lib/api.ts` añade `?champions=<id>` y el
 * middleware del backend devuelve solo el contenido legal. Por eso la Pokédex de
 * abajo, el buscador y **las fichas de siempre** (`/pokemon/:id`, `/tipo/:id`…)
 * quedan restringidas sin una línea de código específica del modo: era el
 * criterio de la tarea, no duplicar la interfaz de consulta.
 *
 * Sin modo activo, la página hace de puerta de entrada: enseña los conjuntos de
 * reglas que hay y deja entrar en uno.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Shield, SlidersHorizontal } from "lucide-react";
import { SearchBar } from "../components/SearchBar";
import { TypeBadge } from "../components/TypeBadge";
import { api } from "../lib/api";
import { championsApi, type ChampionsRulesSummary } from "../lib/apiSession";
import { useActiveChampions } from "../lib/champions";
import { PokeType, PokemonSummary } from "../types";
import { useI18n } from "../i18n";

export default function ChampionsHome() {
  const { t, lang } = useI18n();
  const { champions, enter, exit } = useActiveChampions();

  const [list, setList] = useState<ChampionsRulesSummary[]>([]);
  const [types, setTypes] = useState<PokeType[]>([]);
  const [pokemon, setPokemon] = useState<PokemonSummary[]>([]);

  const nombre = (o: { name_es: string; name_en: string }) =>
    lang === "en" ? o.name_en : o.name_es;

  useEffect(() => {
    championsApi.list().then(setList).catch(() => setList([]));
  }, []);

  // Se vuelven a pedir al entrar o salir del modo: la URL cambia y con ella el
  // contenido. La key de <Routes> en App.tsx no remonta al cambiar de modo.
  useEffect(() => {
    if (!champions) return;
    api.types.list().then(setTypes).catch(() => setTypes([]));
    api.pokemon.list().then(setPokemon).catch(() => setPokemon([]));
  }, [champions]);

  /* ------------------------- fuera del modo ------------------------- */

  if (!champions) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <Shield size={40} className="mx-auto text-ink-soft" aria-hidden="true" />
          <h1 className="font-display font-bold text-2xl text-ink">{t("championsHome.title")}</h1>
          <p className="text-ink-soft text-sm max-w-md mx-auto">{t("championsHome.subtitle")}</p>
        </div>

        {list.length === 0 ? (
          <div className="bg-panel rounded-xl2 shadow-card p-8 text-center animate-fadein">
            <p className="text-ink font-medium mb-1">{t("champions.empty")}</p>
            <p className="text-ink-soft text-sm mb-4">{t("champions.emptyHint")}</p>
            <Link
              to="/champions/reglas"
              className="inline-flex items-center gap-1.5 bg-hover text-ink rounded-lg px-4 py-2.5 text-sm hover:brightness-125 transition"
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              {t("champions.title")}
            </Link>
          </div>
        ) : (
          <>
            <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase">
              {t("championsHome.pick")}
            </h2>
            <ul className="space-y-2">
              {list.map((reglas) => (
                <li key={reglas.id}>
                  <button
                    onClick={() => enter({ id: reglas.id, name: reglas.name })}
                    className="w-full flex items-center gap-3 bg-panel hover:bg-hover rounded-xl2 shadow-card px-4 py-3 text-left transition-colors"
                  >
                    <Shield size={18} className="text-ink-soft shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-ink text-sm truncate">{reglas.name}</span>
                      <span className="block text-ink-soft text-xs">
                        {resumen(reglas, t)}
                      </span>
                    </span>
                    <span className="text-ink-soft text-xs shrink-0">{t("championsHome.enter")}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-center">
              <Link to="/champions/reglas" className="text-ink-soft text-sm underline hover:text-ink">
                {t("champions.title")}
              </Link>
            </p>
          </>
        )}
      </main>
    );
  }

  /* ------------------------- dentro del modo ------------------------ */

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <section className="bg-panel rounded-xl2 shadow-card p-5 animate-fadein">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-[12rem]">
            <p className="flex items-center gap-2 text-ink-soft text-xs uppercase tracking-widest font-display">
              <Shield size={14} aria-hidden="true" />
              {t("championsHome.title")}
            </p>
            <h1 className="font-display font-bold text-2xl text-ink mt-1">{champions.name}</h1>
            <p className="text-ink-soft text-sm mt-1">{t("championsHome.active")}</p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/champions/reglas"
              className="flex items-center gap-1.5 bg-base hover:bg-hover text-ink rounded-lg px-3 py-2.5 text-sm transition-colors"
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              {t("championsHome.editRules")}
            </Link>
            <button
              onClick={exit}
              className="flex items-center gap-1.5 bg-base hover:bg-hover text-ink rounded-lg px-3 py-2.5 text-sm transition-colors"
            >
              <LogOut size={16} aria-hidden="true" />
              {t("championsHome.exit")}
            </button>
          </div>
        </div>
        <div className="mt-4">
          <SearchBar />
        </div>
      </section>

      <section>
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-3">
          {t("championsHome.types")}
        </h2>
        {/* Los tipos NO se filtran: son la física del juego, no contenido que un
            formato pueda prohibir. */}
        <div className="flex flex-wrap gap-2">
          {types.map((tp) => (
            <Link key={tp.id} to={`/tipo/${tp.id}`}>
              <TypeBadge type={tp} />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-3">
          {t("championsHome.pokedex", { n: pokemon.length })}
        </h2>
        {pokemon.length === 0 ? (
          <p className="text-ink-soft text-sm">{t("championsHome.noPokemon")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {pokemon.map((p) => (
              <Link
                key={p.id}
                to={`/pokemon/${p.id}`}
                className="bg-panel hover:bg-hover rounded-xl2 p-4 shadow-card transition-colors flex flex-col items-center gap-1 animate-fadein"
              >
                <span className="text-ink-soft font-mono text-xs">
                  #{String(p.dex).padStart(3, "0")}
                </span>
                <span className="text-ink font-medium text-center">{nombre(p)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Resumen de qué limita un conjunto, para el selector. */
function resumen(reglas: ChampionsRulesSummary, t: (k: string, p?: Record<string, string | number>) => string): string {
  const partes = (["pokemon", "moves", "abilities", "items"] as const)
    .filter((e) => reglas.counts[e] !== null)
    .map((e) => `${t(`champions.entity.${e}`)}: ${reglas.counts[e]}`);
  return partes.length ? partes.join(" · ") : t("champions.noLimits");
}
