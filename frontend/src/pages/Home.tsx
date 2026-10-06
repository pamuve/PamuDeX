import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SearchBar } from "../components/SearchBar";
import { TypeBadge } from "../components/TypeBadge";
import { PokemonSprite } from "../components/PokemonSprite";
import { LoadError, Loading } from "../components/PageState";
import { api } from "../lib/api";
import { clasificarFallo, type Fallo } from "../hooks/useDetail";
import { PokeType, PokemonSummary } from "../types";
import { useI18n } from "../i18n";

export function Home() {
  const { t, name } = useI18n();
  const [types, setTypes] = useState<PokeType[]>([]);
  const [pokemon, setPokemon] = useState<PokemonSummary[] | null>(null);
  // Sin esto, sin red y sin copia local la portada se quedaba en blanco sin
  // decir nada, y la consola acumulaba promesas rechazadas sin capturar.
  const [fallo, setFallo] = useState<Fallo | null>(null);
  const [reintento, setReintento] = useState(0);

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
        <h2 className="section-title mb-3">
          {t("home.pokedex")}
          {pokemon && <span className="ml-2 font-normal tabular-nums text-ink-soft/70">{pokemon.length}</span>}
        </h2>

        {fallo ? (
          <LoadError heading="h2" offline={fallo === "red"} onRetry={() => setReintento((n) => n + 1)} />
        ) : !pokemon ? (
          <Loading />
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
            {pokemon.map((p) => (
              <li key={p.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_10rem]">
                <Link
                  to={`/pokemon/${p.id}`}
                  className="card-link flex h-full flex-col items-center gap-1 p-3 sm:p-4"
                >
                  <span className="self-start font-mono text-xs text-ink-soft tabular-nums">
                    #{String(p.dex).padStart(3, "0")}
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
