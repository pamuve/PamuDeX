import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SearchBar } from "../components/SearchBar";
import { TypeBadge } from "../components/TypeBadge";
import { api } from "../lib/api";
import { PokeType, PokemonSummary } from "../types";
import { useI18n } from "../i18n";

export function Home() {
  const { t } = useI18n();
  const [types, setTypes] = useState<PokeType[]>([]);
  const [pokemon, setPokemon] = useState<PokemonSummary[]>([]);

  useEffect(() => {
    api.types.list().then(setTypes);
    api.pokemon.list().then(setPokemon);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      <section className="text-center space-y-4 py-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink">{t("app.name")}</h1>
        <p className="text-ink-soft max-w-md mx-auto">{t("home.tagline")}</p>
        <SearchBar />
      </section>

      <section>
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-3">Tipos</h2>
        <div className="flex flex-wrap gap-2">
          {types.map((tp) => (
            <Link key={tp.id} to={`/tipo/${tp.id}`}>
              <TypeBadge type={tp} />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-3">Pokédex</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {pokemon.map((p) => (
            <Link
              key={p.id}
              to={`/pokemon/${p.id}`}
              className="bg-panel hover:bg-hover rounded-xl2 p-4 shadow-card transition-colors flex flex-col items-center gap-1 animate-fadein"
            >
              <span className="text-ink-soft font-mono text-xs">#{String(p.dex).padStart(3, "0")}</span>
              <span className="text-ink font-medium text-center">{p.name_es}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
