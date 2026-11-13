import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SearchBar } from "../components/SearchBar";
import { TypeBadge } from "../components/TypeBadge";
import { PokemonSprite } from "../components/PokemonSprite";
import { LoadError, Loading } from "../components/PageState";
import { api } from "../lib/api";
import { clasificarFallo, type Fallo } from "../hooks/useDetail";
import { PokeType, PokemonSummary } from "../types";
import { PokedexFilterBar } from "../components/PokedexFilterBar";
import { PokeballIcon } from "../components/PokeballIcon";
import { NO_FILTERS, applyFilters, hasActiveFilters, type PokedexFilters } from "../lib/pokedex";
import { useCaptures } from "../lib/captures";
import { SlidersHorizontal } from "lucide-react";
import { useI18n } from "../i18n";

/**
 * Los filtros se recuerdan mientras dure la pestaña (`sessionStorage`): al
 * volver de una ficha la Pokédex sigue como se dejó. No son preferencia del
 * perfil ni del aparato, así que no van más lejos.
 */
const FILTERS_KEY = "pamudex_pokedex_filters";

function filtrosGuardados(): PokedexFilters {
  try {
    const raw = sessionStorage.getItem(FILTERS_KEY);
    if (raw) return { ...NO_FILTERS, ...JSON.parse(raw) };
  } catch {
    /* almacenamiento bloqueado o JSON roto: filtros por defecto */
  }
  return NO_FILTERS;
}

export function Home() {
  const { t, name } = useI18n();
  const [types, setTypes] = useState<PokeType[]>([]);
  const [pokemon, setPokemon] = useState<PokemonSummary[] | null>(null);
  // Sin esto, sin red y sin copia local la portada se quedaba en blanco sin
  // decir nada, y la consola acumulaba promesas rechazadas sin capturar.
  const [fallo, setFallo] = useState<Fallo | null>(null);
  const [reintento, setReintento] = useState(0);
  const [filtros, setFiltros] = useState<PokedexFilters>(filtrosGuardados);
  const [panel, setPanel] = useState(() => hasActiveFilters(filtrosGuardados()));
  const captures = useCaptures();

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify(filtros));
    } catch {
      /* sin almacenamiento: los filtros duran lo que dure la página */
    }
  }, [filtros]);

  const generaciones = useMemo(
    () => [...new Set((pokemon || []).map((p) => p.generation))].sort((a, b) => a - b),
    [pokemon]
  );
  // `captures.count` entra en las dependencias para que el filtro de
  // capturados se recalcule al marcar o desmarcar uno.
  const visibles = useMemo(
    () => (pokemon ? applyFilters(pokemon, filtros, name, captures.isCaptured) : []),
    [pokemon, filtros, name, captures.isCaptured, captures.count] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    setFallo(null);
    api.types.list().then(setTypes).catch(() => {});
    api.pokemon
      .list()
      .then(setPokemon)
      .catch((err) => setFallo(clasificarFallo(err)));
  }, [reintento]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-8 sm:space-y-10">
      <section className="space-y-4 sm:text-center">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink">{t("app.name")}</h1>
          <p className="text-ink-soft max-w-md sm:mx-auto text-balance">{t("home.tagline")}</p>
        </div>
        <SearchBar />
      </section>

      {types.length > 0 && (
        <section>
          <h2 className="section-title mb-3">{t("home.types")}</h2>
          <ul className="flex flex-wrap gap-2">
            {types.map((tp) => (
              <li key={tp.id}>
                <Link to={`/tipo/${tp.id}`} className="pressable inline-flex rounded-full">
                  <TypeBadge type={tp} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">
            {t("home.pokedex")}
            {pokemon && (
              <span className="ml-2 font-normal tabular-nums text-ink-soft/70">
                {visibles.length === pokemon.length ? pokemon.length : `${visibles.length} / ${pokemon.length}`}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {captures.enabled && pokemon && (
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft tabular-nums">
                <PokeballIcon size={16} filled />
                <span className="sr-only">{t("captures.title")}: </span>
                {captures.count} / {pokemon.length}
              </span>
            )}
            <button
              type="button"
              onClick={() => setPanel((v) => !v)}
              aria-expanded={panel}
              className={`btn-ghost ${hasActiveFilters(filtros) ? "text-accent" : ""}`}
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              {t("pokedex.filters")}
            </button>
          </div>
        </div>
        {panel && (
          <div className="mb-3">
            <PokedexFilterBar
              types={types}
              generations={generaciones}
              value={filtros}
              onChange={setFiltros}
              showCapture={captures.enabled}
            />
          </div>
        )}
        {/* Lo que cambia lejos del control que lo provoca se anuncia (8.2). */}
        <span className="sr-only" role="status" aria-live="polite">
          {pokemon && hasActiveFilters(filtros) ? t("pokedex.results", { count: visibles.length }) : ""}
        </span>
        {fallo ? (
          <LoadError heading="h2" offline={fallo === "red"} onRetry={() => setReintento((n) => n + 1)} />
        ) : !pokemon ? (
          <Loading />
        ) : visibles.length === 0 ? (
          <p className="notice text-sm">{t("pokedex.empty")}</p>
        ) : (
          /*
            Columnas por ancho mínimo y no por punto de corte: 2 en un móvil de
            4", 3 en uno grande, de 4 a 7 en tableta y escritorio. El mínimo va
            en `rem`, así que con el texto al 130% (8.1) caben menos columnas en
            vez de partirse los nombres.

            `content-visibility: auto` es lo que hace llevable pintar las 1025
            tarjetas: el navegador se salta el diseño y el pintado de las que
            están fuera de pantalla. `contain-intrinsic-size` reserva su alto
            para que la barra de desplazamiento no baile.
          */
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(8.5rem,100%),1fr))] gap-2.5 sm:gap-3">
            {visibles.map((p) => (
              <li key={p.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_10rem]">
                <Link
                  to={`/pokemon/${p.id}`}
                  className="card-link flex h-full flex-col items-center gap-1 p-3 sm:p-4"
                >
                  <span className="flex w-full items-center justify-between font-mono text-xs text-ink-soft tabular-nums">
                    #{String(p.dex).padStart(3, "0")}
                    {captures.isCaptured(p.id) && (
                      <span className="text-success" title={t("captures.captured")}>
                        <PokeballIcon size={14} filled />
                        <span className="sr-only">{t("captures.captured")}</span>
                      </span>
                    )}
                  </span>
                  <PokemonSprite dex={p.dex} nombre={name(p)} />
                  {/* `break-words`: al 130% de escalado (8.1) un nombre largo
                      («Crabominable») no cabe en una columna de 4". */}
                  <span className="w-full break-words text-center text-sm font-medium text-ink">{name(p)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
