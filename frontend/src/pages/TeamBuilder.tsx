import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../lib/api";
import {
  loadTeam,
  saveTeam,
  loadRivalTeam,
  saveRivalTeam,
  emptyTeamSlot,
  emptyRivalSlot,
  MAX_TEAM_SIZE,
} from "../lib/team";
import { bestResponseAgainst } from "../lib/recommendation";
import { analyzeTeamCoverage } from "../lib/coverage";
import { TeamSlotCard } from "../components/TeamSlotCard";
import { RivalSlotCard } from "../components/RivalSlotCard";
import { RecommendationCard } from "../components/RecommendationCard";
import { CoverageMap } from "../components/CoverageMap";
import { useI18n } from "../i18n";
import { Team, RivalTeam, PokemonSummary, PokemonDetail, MoveSummary, TypeDetail } from "../types";

function AddPokemonBox({
  allPokemon,
  disabled,
  placeholder,
  onAdd,
}: {
  allPokemon: PokemonSummary[];
  disabled: boolean;
  placeholder: string;
  onAdd: (dex: number, id: number) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = allPokemon.filter((p) => p.name_es.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  if (disabled) return null;

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full bg-hover rounded-xl2 px-4 py-3 text-sm text-ink outline-none"
      />
      {open && q.length > 0 && (
        <div className="absolute mt-1 w-full bg-panel border border-hover rounded-xl2 shadow-card max-h-56 overflow-auto z-20 animate-fadein">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onAdd(p.dex, p.id);
                setQ("");
                setOpen(false);
              }}
              className="w-full flex items-center justify-between text-left px-4 py-2 hover:bg-hover text-sm text-ink"
            >
              <span>{p.name_es}</span>
              <Plus size={14} className="text-ink-soft" />
            </button>
          ))}
          {filtered.length === 0 && <div className="px-4 py-2 text-sm text-ink-soft">—</div>}
        </div>
      )}
    </div>
  );
}

export function TeamBuilder() {
  const { t } = useI18n();
  const [ownTeam, setOwnTeam] = useState<Team>({ slots: [] });
  const [rivalTeam, setRivalTeam] = useState<RivalTeam>({ slots: [] });
  const [allPokemon, setAllPokemon] = useState<PokemonSummary[]>([]);
  const [allMoves, setAllMoves] = useState<MoveSummary[]>([]);
  const [typesById, setTypesById] = useState<Record<string, TypeDetail>>({});
  const [pokemonCache, setPokemonCache] = useState<Record<number, PokemonDetail>>({});

  // Carga inicial: equipo guardado + catálogos
  useEffect(() => {
    setOwnTeam(loadTeam());
    setRivalTeam(loadRivalTeam());
    api.pokemon.list().then(setAllPokemon);
    api.moves.list().then(setAllMoves);
    api.types.list().then((list) => {
      Promise.all(list.map((tp) => api.types.detail(tp.id))).then((details) => {
        setTypesById(Object.fromEntries(details.map((d) => [d.id, d])));
      });
    });
  }, []);

  // Persistencia automática
  useEffect(() => saveTeam(ownTeam), [ownTeam]);
  useEffect(() => saveRivalTeam(rivalTeam), [rivalTeam]);

  // Carga perezosa de fichas de Pokémon que aún no estén en caché
  useEffect(() => {
    const neededIds = new Set<number>([
      ...ownTeam.slots.map((s) => s.pokemonId),
      ...rivalTeam.slots.map((s) => s.pokemonId),
    ]);
    const missing = [...neededIds].filter((id) => !pokemonCache[id]);
    if (missing.length === 0) return;
    Promise.all(missing.map((id) => api.pokemon.detail(id))).then((details) => {
      setPokemonCache((prev) => ({ ...prev, ...Object.fromEntries(details.map((d) => [d.id, d])) }));
    });
  }, [ownTeam, rivalTeam, pokemonCache]);

  const movesById = useMemo(() => Object.fromEntries(allMoves.map((m) => [m.id, m])), [allMoves]);

  function addOwn(_dex: number, id: number) {
    if (ownTeam.slots.length >= MAX_TEAM_SIZE) return;
    setOwnTeam({ slots: [...ownTeam.slots, emptyTeamSlot(id)] });
  }
  function addRival(_dex: number, id: number) {
    if (rivalTeam.slots.length >= MAX_TEAM_SIZE) return;
    setRivalTeam({ slots: [...rivalTeam.slots, emptyRivalSlot(id)] });
  }

  const coverage = useMemo(
    () => analyzeTeamCoverage(ownTeam.slots, pokemonCache, movesById, typesById),
    [ownTeam, pokemonCache, movesById, typesById]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <h1 className="font-display text-2xl font-bold text-ink text-center">{t("team.title")}</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase">{t("team.own")}</h2>
            <span className="text-xs text-ink-soft">{ownTeam.slots.length}/{MAX_TEAM_SIZE}</span>
          </div>

          {ownTeam.slots.length >= MAX_TEAM_SIZE ? (
            <div className="text-sm text-ink-soft bg-hover rounded-xl2 px-4 py-3 text-center">{t("team.full")}</div>
          ) : (
            <AddPokemonBox allPokemon={allPokemon} disabled={false} placeholder={t("team.search_placeholder")} onAdd={addOwn} />
          )}

          {ownTeam.slots.length === 0 && <p className="text-ink-soft text-sm">{t("team.empty_own")}</p>}

          <div className="space-y-3">
            {ownTeam.slots.map((slot, idx) => (
              <TeamSlotCard
                key={`${slot.pokemonId}-${idx}`}
                slot={slot}
                pokemon={pokemonCache[slot.pokemonId] ?? null}
                allMoves={allMoves}
                onChange={(updated) =>
                  setOwnTeam({ slots: ownTeam.slots.map((s, i) => (i === idx ? updated : s)) })
                }
                onRemove={() => setOwnTeam({ slots: ownTeam.slots.filter((_, i) => i !== idx) })}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase">{t("team.rival")}</h2>
            <span className="text-xs text-ink-soft">{rivalTeam.slots.length}/{MAX_TEAM_SIZE}</span>
          </div>

          {rivalTeam.slots.length >= MAX_TEAM_SIZE ? (
            <div className="text-sm text-ink-soft bg-hover rounded-xl2 px-4 py-3 text-center">{t("team.full")}</div>
          ) : (
            <AddPokemonBox allPokemon={allPokemon} disabled={false} placeholder={t("team.search_placeholder")} onAdd={addRival} />
          )}

          {rivalTeam.slots.length === 0 && <p className="text-ink-soft text-sm">{t("team.empty_rival")}</p>}

          <div className="space-y-3">
            {rivalTeam.slots.map((slot, idx) => (
              <RivalSlotCard
                key={`${slot.pokemonId}-${idx}`}
                slot={slot}
                pokemon={pokemonCache[slot.pokemonId] ?? null}
                allMoves={allMoves}
                onChange={(updated) =>
                  setRivalTeam({ slots: rivalTeam.slots.map((s, i) => (i === idx ? updated : s)) })
                }
                onRemove={() => setRivalTeam({ slots: rivalTeam.slots.filter((_, i) => i !== idx) })}
              />
            ))}
          </div>
        </section>
      </div>

      {rivalTeam.slots.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase">{t("recommendation.title")}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {rivalTeam.slots.map((rival, idx) => {
              const rivalPokemon = pokemonCache[rival.pokemonId];
              if (!rivalPokemon) return null;
              const recommendation = bestResponseAgainst(rival, rivalPokemon, ownTeam.slots, pokemonCache, movesById);
              return (
                <RecommendationCard
                  key={`${rival.pokemonId}-${idx}`}
                  recommendation={recommendation}
                  rivalPokemon={rivalPokemon}
                  pokemonById={pokemonCache}
                />
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase">{t("coverage.title")}</h2>
        {ownTeam.slots.length === 0 ? (
          <p className="text-ink-soft text-sm">{t("coverage.empty")}</p>
        ) : (
          <CoverageMap report={coverage} typesById={typesById} />
        )}
      </section>
    </div>
  );
}
