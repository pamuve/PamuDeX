import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useCombobox } from "../hooks/useCombobox";
import { useI18n } from "../i18n";
import { Team, RivalTeam, PokemonSummary, PokemonDetail, MoveSummary, TypeDetail, ItemSummary } from "../types";

/**
 * Autocompletado para añadir un Pokémon al equipo.
 *
 * Es el segundo `combobox` de la app (8.2) y comparte el teclado con el
 * buscador global a través de `hooks/useCombobox`: flechas para recorrer,
 * `Enter` para añadir, `Escape` para cerrar y otra vez `Escape` para limpiar.
 * El foco no se mueve del campo, que es lo que distingue este patrón del menú
 * de la barra superior.
 *
 * `label` sustituye al marcador de posición como nombre accesible: el
 * marcador desaparece en cuanto se escribe, y aquí hay DOS campos idénticos en
 * la misma página (equipo propio y rival) que sin nombre no se distinguen.
 */
function AddPokemonBox({
  allPokemon,
  disabled,
  label,
  placeholder,
  onAdd,
}: {
  allPokemon: PokemonSummary[];
  disabled: boolean;
  label: string;
  placeholder: string;
  onAdd: (dex: number, id: number) => void;
}) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const nombre = (p: PokemonSummary) => (lang === "en" ? p.name_en : p.name_es);
  const filtered = allPokemon
    .filter((p) => nombre(p).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8);

  function elegir(p: PokemonSummary) {
    onAdd(p.dex, p.id);
    setQ("");
    combo.setOpen(false);
    combo.setActivo(-1);
  }

  const combo = useCombobox({
    count: filtered.length,
    onSelect: (i) => elegir(filtered[i]),
    onEscapeClosed: () => setQ(""),
  });

  const abierta = combo.open && q.length > 0;

  if (disabled) return null;

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          combo.setOpen(true);
        }}
        onFocus={() => combo.setOpen(true)}
        onBlur={() => combo.setOpen(false)}
        placeholder={placeholder}
        aria-label={label}
        {...combo.inputProps}
        aria-expanded={abierta}
        className="w-full bg-hover rounded-xl2 px-4 py-3 text-sm text-ink outline-none"
      />
      <span className="sr-only" role="status" aria-live="polite">
        {abierta ? t("search.count", { count: filtered.length }) : ""}
      </span>
      {abierta && (
        <ul
          ref={combo.listRef}
          id={combo.listId}
          role="listbox"
          aria-label={label}
          className="absolute mt-1 w-full bg-panel border border-hover rounded-xl2 shadow-card max-h-56 overflow-auto z-20 animate-fadein"
        >
          {filtered.map((p, i) => (
            <li
              key={p.id}
              id={combo.optionId(i)}
              role="option"
              aria-selected={i === combo.activo}
              // `onMouseDown`: el `blur` del campo cierra la lista antes de que
              // llegue el `click`, así que para entonces la fila ya no existe.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(p);
              }}
              onMouseEnter={() => combo.setActivo(i)}
              className={`flex items-center justify-between px-4 py-2 text-sm text-ink cursor-pointer ${
                i === combo.activo ? "bg-hover" : ""
              }`}
            >
              <span>{nombre(p)}</span>
              <Plus size={14} className="text-ink-soft" aria-hidden="true" />
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-2 text-sm text-ink-soft">{t("empty.results")}</li>
          )}
        </ul>
      )}
    </div>
  );
}

export function TeamBuilder() {
  const { t, lang } = useI18n();
  const nombreDe = useCallback(
    (p: { name_es: string; name_en: string }) => (lang === "en" ? p.name_en : p.name_es),
    [lang]
  );
  const [ownTeam, setOwnTeam] = useState<Team>({ slots: [] });
  const [rivalTeam, setRivalTeam] = useState<RivalTeam>({ slots: [] });
  const [allPokemon, setAllPokemon] = useState<PokemonSummary[]>([]);
  const [allMoves, setAllMoves] = useState<MoveSummary[]>([]);
  const [allItems, setAllItems] = useState<ItemSummary[]>([]);
  const [typesById, setTypesById] = useState<Record<string, TypeDetail>>({});
  const [pokemonCache, setPokemonCache] = useState<Record<number, PokemonDetail>>({});

  /*
    POR QUÉ HACE FALTA ESTA BANDERA: sin ella se perdía el equipo al recargar.

    En el montaje, los efectos corren en orden de declaración: el de carga
    llamaba a `loadTeam()` y el de persistencia guardaba acto seguido el estado
    inicial —`{ slots: [] }`, el de ESTE render, porque el `setState` de arriba
    aún no ha repintado—, dejando `localStorage` vacío. Con `StrictMode` React
    vuelve a lanzar los efectos, y en esa segunda vuelta `loadTeam()` ya leía el
    hueco que acababa de dejar el primero: equipo borrado en cada recarga.

    Es una bandera de estado y no un `useRef`: el `ref` se pondría a `true`
    dentro del efecto de carga, que corre ANTES que el de guardado en la misma
    vuelta, y el guardado en vacío pasaría igual. Como estado, el efecto de
    guardar no se vuelve a lanzar hasta el render siguiente, cuando el equipo
    cargado ya está en su sitio.
  */
  const [cargado, setCargado] = useState(false);

  // Carga inicial: equipo guardado + catálogos
  useEffect(() => {
    setOwnTeam(loadTeam());
    setRivalTeam(loadRivalTeam());
    setCargado(true);
    api.pokemon.list().then(setAllPokemon);
    api.moves.list().then(setAllMoves);
    /*
      El catálogo entero de objetos, una vez, y el filtrado en local: es lo mismo
      que ya se hace con los 1025 Pokémon y los 901 movimientos. Son 2151 filas
      ligeras (~157 KB sin comprimir, sin `effect_es`) y así el autocompletado
      responde sin ir a la red en cada tecla. Pedirlos con `?q=` por pulsación
      sería una petición por letra y dejaría el campo inútil sin conexión.

      Sin argumentos, `api.items.list()` pasa por la caché de IndexedDB
      (`RUTAS_CATALOGO`), así que en la segunda visita responde sin red.
    */
    api.items.list().then(setAllItems);
    api.types.list().then((list) => {
      Promise.all(list.map((tp) => api.types.detail(tp.id))).then((details) => {
        setTypesById(Object.fromEntries(details.map((d) => [d.id, d])));
      });
    });
  }, []);

  // Persistencia automática, nunca antes de haber leído lo que ya había.
  useEffect(() => {
    if (cargado) saveTeam(ownTeam);
  }, [cargado, ownTeam]);
  useEffect(() => {
    if (cargado) saveRivalTeam(rivalTeam);
  }, [cargado, rivalTeam]);

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

  /*
    Las recomendaciones salen del render y pasan a un `useMemo` (8.2). Hace
    falta para poder resumirlas en la región `aria-live` sin calcularlas dos
    veces —`bestResponseAgainst` recorre movimientos y tipos por cada rival— y
    de paso dejan de recalcularse en cada repintado por cualquier motivo.
  */
  const recomendaciones = useMemo(
    () =>
      rivalTeam.slots
        .map((rival, idx) => {
          const rivalPokemon = pokemonCache[rival.pokemonId];
          if (!rivalPokemon) return null;
          return {
            key: `${rival.pokemonId}-${idx}`,
            rival,
            rivalPokemon,
            recommendation: bestResponseAgainst(
              rival,
              rivalPokemon,
              ownTeam.slots,
              pokemonCache,
              movesById
            ),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    [rivalTeam, ownTeam, pokemonCache, movesById]
  );

  /** Lo que se anuncia: contra quién, a quién sacar. Vacío si no hay rivales. */
  const resumenRecomendaciones = useMemo(() => {
    if (!recomendaciones.length) return "";
    const partes = recomendaciones.map((r) => {
      const mejor = r.recommendation.ranked[0];
      const elegido = mejor ? pokemonCache[mejor.pokemonId] : null;
      return t("recommendation.announceOne", {
        rival: nombreDe(r.rivalPokemon),
        name: elegido ? nombreDe(elegido) : t("recommendation.no_candidates"),
      });
    });
    return t("recommendation.announce", { list: partes.join("; ") });
  }, [recomendaciones, pokemonCache, t, nombreDe]);

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
            <AddPokemonBox
              allPokemon={allPokemon}
              disabled={false}
              label={t("team.addToOwn")}
              placeholder={t("team.search_placeholder")}
              onAdd={addOwn}
            />
          )}

          {ownTeam.slots.length === 0 && <p className="text-ink-soft text-sm">{t("team.empty_own")}</p>}

          <div className="space-y-3">
            {ownTeam.slots.map((slot, idx) => (
              <TeamSlotCard
                key={`${slot.pokemonId}-${idx}`}
                slot={slot}
                pokemon={pokemonCache[slot.pokemonId] ?? null}
                allMoves={allMoves}
                allItems={allItems}
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
            <AddPokemonBox
              allPokemon={allPokemon}
              disabled={false}
              label={t("team.addToRival")}
              placeholder={t("team.search_placeholder")}
              onAdd={addRival}
            />
          )}

          {rivalTeam.slots.length === 0 && <p className="text-ink-soft text-sm">{t("team.empty_rival")}</p>}

          <div className="space-y-3">
            {rivalTeam.slots.map((slot, idx) => (
              <RivalSlotCard
                key={`${slot.pokemonId}-${idx}`}
                slot={slot}
                pokemon={pokemonCache[slot.pokemonId] ?? null}
                allMoves={allMoves}
                allItems={allItems}
                onChange={(updated) =>
                  setRivalTeam({ slots: rivalTeam.slots.map((s, i) => (i === idx ? updated : s)) })
                }
                onRemove={() => setRivalTeam({ slots: rivalTeam.slots.filter((_, i) => i !== idx) })}
              />
            ))}
          </div>
        </section>
      </div>

      {/*
        Región `aria-live` de las recomendaciones (Tarea 8.2).

        Es el cambio dinámico importante de la app: tocar un movimiento o una
        naturaleza en cualquier tarjeta puede cambiar a quién conviene sacar, y
        eso pasa lejos del control que se acaba de usar. Sin anunciarlo, quien
        no ve la pantalla no se entera de que ha cambiado nada.

        `polite` y no `assertive`: no debe cortar al lector mientras el usuario
        sigue configurando. Va SIEMPRE montada aunque no haya rivales: una
        región que aparece y desaparece del DOM no se anuncia de forma fiable.
      */}
      <span className="sr-only" role="status" aria-live="polite">
        {resumenRecomendaciones}
      </span>

      {rivalTeam.slots.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase">{t("recommendation.title")}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {recomendaciones.map(({ rival, rivalPokemon, recommendation, key }) => (
              <RecommendationCard
                key={key}
                recommendation={recommendation}
                rivalPokemon={rivalPokemon}
                pokemonById={pokemonCache}
                movesById={movesById}
              />
            ))}
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
