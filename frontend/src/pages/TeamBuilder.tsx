import { useEffect, useMemo, useRef, useState } from "react";
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
import { AddPokemonBox } from "../components/AddPokemonBox";
import { SavedTeamsPanel, TeamTextPanel } from "../components/TeamTools";
import { useSessionOptions } from "../lib/sessionOptions";
import { useI18n } from "../i18n";
import { Team, RivalTeam, PokemonSummary, PokemonDetail, MoveSummary, TypeDetail, ItemSummary } from "../types";

export function TeamBuilder() {
  const { t, name: nombreDe } = useI18n();
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
  // Un catálogo que no llega deja los autocompletados vacíos sin explicación;
  // basta un aviso, porque el equipo guardado sigue viéndose.
  const [falloCarga, setFalloCarga] = useState(false);

  // Carga inicial: equipo guardado + catálogos
  useEffect(() => {
    setOwnTeam(loadTeam());
    setRivalTeam(loadRivalTeam());
    setCargado(true);
    const fallo = () => setFalloCarga(true);
    api.pokemon.list().then(setAllPokemon).catch(fallo);
    api.moves.list().then(setAllMoves).catch(fallo);
    /*
      El catálogo entero de objetos, una vez, y el filtrado en local: es lo mismo
      que ya se hace con los 1025 Pokémon y los 901 movimientos. Son 2151 filas
      ligeras (~157 KB sin comprimir, sin `effect_es`) y así el autocompletado
      responde sin ir a la red en cada tecla. Pedirlos con `?q=` por pulsación
      sería una petición por letra y dejaría el campo inútil sin conexión.

      Sin argumentos, `api.items.list()` pasa por la caché de IndexedDB
      (`RUTAS_CATALOGO`), así que en la segunda visita responde sin red.
    */
    api.items.list().then(setAllItems).catch(fallo);
    api.types
      .list()
      .then((list) => Promise.all(list.map((tp) => api.types.detail(tp.id))))
      .then((details) => setTypesById(Object.fromEntries(details.map((d) => [d.id, d]))))
      .catch(fallo);
  }, []);

  // Persistencia automática, nunca antes de haber leído lo que ya había.
  useEffect(() => {
    if (cargado) saveTeam(ownTeam);
  }, [cargado, ownTeam]);
  useEffect(() => {
    if (cargado) saveRivalTeam(rivalTeam);
  }, [cargado, rivalTeam]);

  // Carga perezosa de fichas de Pokémon que aún no estén en caché.
  //
  // `allSettled` y no `all`: con `all`, una sola ficha que fallase (un Pokémon
  // que ya no existe, o no permitido en Champions) dejaba sin cargar a TODO el
  // equipo. Ahora cada una va por su cuenta y solo falta la que falla.
  //
  // Se guardan bajo el id PEDIDO, no bajo `d.id`: el backend acepta también el
  // nº de Pokédex, y si resolvía por ahí la ficha entraba con otro id, el hueco
  // seguía «faltando» y este efecto la volvía a pedir sin fin.
  //
  // `pedidas` evita repetir una petición que ya está en vuelo cuando el equipo
  // cambia a mitad de la carga.
  const pedidas = useRef(new Set<number>());
  useEffect(() => {
    const neededIds = new Set<number>([
      ...ownTeam.slots.map((s) => s.pokemonId),
      ...rivalTeam.slots.map((s) => s.pokemonId),
    ]);
    const missing = [...neededIds].filter((id) => !pokemonCache[id] && !pedidas.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => pedidas.current.add(id));

    Promise.allSettled(missing.map((id) => api.pokemon.detail(id))).then((resultados) => {
      const nuevas: Record<number, PokemonDetail> = {};
      let algunFallo = false;
      resultados.forEach((r, i) => {
        if (r.status === "fulfilled") nuevas[missing[i]] = r.value;
        else algunFallo = true;
        pedidas.current.delete(missing[i]);
      });
      if (Object.keys(nuevas).length) setPokemonCache((prev) => ({ ...prev, ...nuevas }));
      if (algunFallo) setFalloCarga(true);
    });
  }, [ownTeam, rivalTeam, pokemonCache]);

  /*
    MOVIMIENTOS QUE APRENDE CADA POKÉMON (Fase 9)
    Cada tarjeta ofrecía los 901 movimientos del catálogo. Ahora ofrece los que
    ese Pokémon aprende, más los que ya tuviera elegidos (un equipo guardado
    antes de esto, o importado, no debe perderlos de la lista).

    El filtro se quita en dos casos: la casilla «todos los movimientos», y un
    ROM Hack marcado como «cualquier Pokémon aprende cualquier movimiento»
    (`options.any_move` de la sesión), donde la lista del dataset no manda.
    Si no se puede pedir lo que aprende, también se ofrece todo: es mejor una
    lista larga que una vacía.
  */
  const options = useSessionOptions();
  const [todosLosMovimientos, setTodosLosMovimientos] = useState(false);
  const [aprende, setAprende] = useState<Record<number, Set<number>>>({});
  const aprendePedidos = useRef(new Set<number>());
  const sinFiltroDeMovimientos = todosLosMovimientos || Boolean(options.any_move);

  useEffect(() => {
    if (sinFiltroDeMovimientos) return;
    const ids = new Set<number>([...ownTeam.slots, ...rivalTeam.slots].map((s) => s.pokemonId));
    for (const id of ids) {
      if (aprende[id] || aprendePedidos.current.has(id)) continue;
      aprendePedidos.current.add(id);
      api.extra
        .pokemon(id)
        .then((d) => setAprende((prev) => ({ ...prev, [id]: new Set(d.moves.map((m) => m.move_id)) })))
        .catch(() => aprendePedidos.current.delete(id));
    }
  }, [ownTeam, rivalTeam, aprende, sinFiltroDeMovimientos]);

  function movimientosPara(pokemonId: number, elegidos: number[]): MoveSummary[] {
    const set = aprende[pokemonId];
    if (sinFiltroDeMovimientos || !set || set.size === 0) return allMoves;
    return allMoves.filter((m) => set.has(m.id) || elegidos.includes(m.id));
  }

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
          // Contra un rival ya derrotado no hay nada que responder.
          if (!rivalPokemon || rival.defeated) return null;
          return {
            key: `${rival.pokemonId}-${idx}`,
            rival,
            rivalPokemon,
            recommendation: bestResponseAgainst(
              rival,
              rivalPokemon,
              // Un Pokémon propio derrotado no se puede sacar: no se recomienda.
              ownTeam.slots.filter((s) => !s.defeated),
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
      <h1 className="page-title">{t("team.title")}</h1>

      {falloCarga && (
        <p role="alert" className="rounded-xl2 bg-danger/10 px-4 py-3 text-sm text-ink">
          {t("common.loadErrorInline")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {!options.any_move && (
          <label className="inline-flex min-h-[2.75rem] items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={todosLosMovimientos}
              onChange={(e) => setTodosLosMovimientos(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            {t("team.allMoves")}
          </label>
        )}
        {options.any_move && <p className="text-sm text-ink-soft">{t("learnset.anyMove")}</p>}
        {(ownTeam.slots.some((s) => s.defeated) || rivalTeam.slots.some((s) => s.defeated)) && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              // Combate nuevo: todos vuelven a estar disponibles.
              setOwnTeam({ slots: ownTeam.slots.map((s) => ({ ...s, defeated: false })) });
              setRivalTeam({ slots: rivalTeam.slots.map((s) => ({ ...s, defeated: false })) });
            }}
          >
            {t("team.reviveAll")}
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">{t("team.own")}</h2>
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
                allMoves={movimientosPara(slot.pokemonId, slot.moveIds)}
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
            <h2 className="section-title">{t("team.rival")}</h2>
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
                allMoves={movimientosPara(slot.pokemonId, [...slot.knownMoveIds, ...slot.suspectedMoveIds])}
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
          <h2 className="section-title">{t("recommendation.title")}</h2>
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
        <h2 className="section-title">{t("coverage.title")}</h2>
        {ownTeam.slots.length === 0 ? (
          <p className="text-ink-soft text-sm">{t("coverage.empty")}</p>
        ) : (
          <CoverageMap report={coverage} typesById={typesById} />
        )}
      </section>

      {/* Guardar con nombre e importar/exportar (Fase 9). Al final: son
          gestión del equipo, no parte del combate que se está mirando. */}
      {/* `min-w-0` en los hijos: un elemento de rejilla no encoge por debajo
          del ancho mínimo de su contenido, y a 320px con el texto al 130% el
          cuadro de texto empujaba la página entera. */}
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <SavedTeamsPanel
          own={ownTeam}
          rival={rivalTeam}
          onLoad={(own, rival) => {
            setOwnTeam(own);
            setRivalTeam(rival);
          }}
        />
        <TeamTextPanel
          own={ownTeam}
          rival={rivalTeam}
          catalog={{ pokemon: allPokemon, moves: allMoves, items: allItems }}
          pokemonById={pokemonCache}
          onImport={(_destino, own, rival) => {
            setOwnTeam(own);
            setRivalTeam(rival);
          }}
        />
      </div>
    </div>
  );
}
