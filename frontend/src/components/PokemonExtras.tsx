/**
 * PamuDeX — Fase 9
 * Las tres secciones «extra» de la ficha de un Pokémon: línea evolutiva, formas
 * y movimientos que aprende. Y la inversa para la ficha de un movimiento.
 *
 * `/api/extra/*` devuelve solo ids (ver `backend/routes/extra.js`). Los nombres,
 * tipos y colores salen de `api.pokemon.list()` y `api.moves.list()`, que ya
 * están en memoria y llevan aplicada la sesión o el filtro de Champions. Por eso
 * un miembro de la familia o un movimiento que NO esté en el listado no se
 * pinta: en Champions significa «no permitido», y enseñarlo llevaría a una
 * ficha que responde 404.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { useSessionOptions } from "../lib/sessionOptions";
import { PokemonSprite } from "./PokemonSprite";
import { TypeBadge } from "./TypeBadge";
import { useI18n } from "../i18n";
import type {
  EvolutionEdge,
  LearnMethod,
  MoveSummary,
  PokemonExtra,
  PokemonForm,
  PokemonSummary,
  PokeType,
} from "../types";

/** Los datos extra de un Pokémon. `null` mientras carga o si no se pudieron pedir. */
export function usePokemonExtra(pokemonId: number | undefined): PokemonExtra | null {
  const [extra, setExtra] = useState<PokemonExtra | null>(null);
  useEffect(() => {
    setExtra(null);
    if (pokemonId === undefined) return;
    let cancelado = false;
    api.extra
      .pokemon(pokemonId)
      .then((d) => !cancelado && setExtra(d))
      .catch(() => {
        /* sin red y sin copia: la ficha se queda sin estas secciones, no rota */
      });
    return () => {
      cancelado = true;
    };
  }, [pokemonId]);
  return extra;
}

/** Un listado del catálogo, indexado por id. Vacío hasta que llega. */
function usePorId<T extends { id: number }>(cargar: () => Promise<T[]>): Map<number, T> {
  const [mapa, setMapa] = useState<Map<number, T>>(new Map());
  useEffect(() => {
    let cancelado = false;
    cargar()
      .then((lista) => !cancelado && setMapa(new Map(lista.map((x) => [x.id, x]))))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return mapa;
}

/* ----------------------------- línea evolutiva ---------------------------- */

export function EvolutionLine({ extra, currentId }: { extra: PokemonExtra | null; currentId: number }) {
  const { t, lang, name } = useI18n();
  const pokemon = usePorId<PokemonSummary>(api.pokemon.list);

  // Etapas por profundidad desde la raíz: [[raíz], [sus evoluciones], [las de estas]].
  const etapas = useMemo(() => {
    if (!extra || !extra.evolutions.edges.length) return [];
    const hijos = new Map<number, EvolutionEdge[]>();
    for (const e of extra.evolutions.edges) {
      if (!hijos.has(e.from)) hijos.set(e.from, []);
      hijos.get(e.from)!.push(e);
    }
    const filas: { id: number; via: EvolutionEdge | null }[][] = [[{ id: extra.evolutions.root, via: null }]];
    const vistos = new Set([extra.evolutions.root]);
    for (let nivel = 0; nivel < 5; nivel++) {
      const siguiente = filas[nivel]
        .flatMap((nodo) => hijos.get(nodo.id) || [])
        .filter((e) => !vistos.has(e.to) && vistos.add(e.to))
        .map((e) => ({ id: e.to, via: e }));
      if (!siguiente.length) break;
      filas.push(siguiente);
    }
    return filas;
  }, [extra]);

  // Sin familia (no evoluciona) o con el listado aún sin llegar, no hay sección.
  if (etapas.length < 2 || pokemon.size === 0) return null;
  const visibles = etapas.map((fila) => fila.filter((n) => pokemon.has(n.id))).filter((fila) => fila.length);
  if (visibles.length < 2) return null;

  return (
    <section className="card animate-fadein">
      <h2 className="section-title mb-3">{t("pokemon.evolutions")}</h2>
      <ol className="flex flex-col items-stretch gap-2 overflow-x-auto pb-1 sm:flex-row sm:items-center sm:gap-3">
        {visibles.map((fila, i) => (
          <li key={i} className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
            {i > 0 && (
              <ChevronRight
                size={18}
                aria-hidden="true"
                className="mx-auto shrink-0 rotate-90 text-ink-soft sm:rotate-0"
              />
            )}
            <ul className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:min-w-[8.5rem] sm:flex-col sm:flex-nowrap">
              {fila.map(({ id, via }) => {
                const p = pokemon.get(id)!;
                const actual = id === currentId;
                const metodo = via ? (lang === "en" && via.method_en ? via.method_en : via.method_es) : null;
                return (
                  <li key={id} className="w-[min(8.5rem,47%)] sm:w-full">
                    <Link
                      to={`/pokemon/${id}`}
                      aria-current={actual ? "page" : undefined}
                      className={`card-link flex h-full w-full flex-col items-center gap-0.5 p-2 text-center ${
                        actual ? "ring-2 ring-accent" : ""
                      }`}
                    >
                      <PokemonSprite dex={p.dex} nombre={name(p)} className="h-14 w-14" />
                      <span className="break-words text-sm font-medium text-ink">{name(p)}</span>
                      {metodo && <span className="text-xs text-ink-soft text-balance">{metodo}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------------------------------- formas -------------------------------- */

const STAT_ORDER = ["hp", "atk", "def", "spa", "spd", "spe"] as const;

function FormCard({ form, typesById }: { form: PokemonForm; typesById: Record<string, PokeType> }) {
  const { t, name } = useI18n();
  const total = STAT_ORDER.reduce((n, k) => n + (form.stats[k] || 0), 0);
  return (
    <li className="rounded-xl2 bg-hover/50 p-3">
      <div className="flex items-center gap-3">
        <PokemonSprite dex={0} formId={form.sprite_id} nombre={name(form)} className="h-16 w-16 shrink-0" />
        <div className="min-w-0 space-y-1.5">
          <div className="break-words font-medium text-ink">{name(form)}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {form.types.map((id) =>
              typesById[id] ? <TypeBadge key={id} type={typesById[id]} size="sm" /> : null
            )}
            <span className="text-xs text-ink-soft">{t(`forms.kind.${form.kind}`)}</span>
          </div>
        </div>
      </div>
      <dl className="mt-2.5 grid grid-cols-7 gap-1 text-center tabular-nums">
        {STAT_ORDER.map((k) => (
          <div key={k}>
            <dt className="text-[0.6875rem] text-ink-soft">{t(`stat.short.${k}`)}</dt>
            <dd className="font-mono text-sm text-ink">{form.stats[k]}</dd>
          </div>
        ))}
        <div>
          <dt className="text-[0.6875rem] font-semibold text-ink-soft">{t("stat.short.total")}</dt>
          <dd className="font-mono text-sm font-semibold text-ink">{total}</dd>
        </div>
      </dl>
    </li>
  );
}

export function FormsSection({
  extra,
  typesById,
}: {
  extra: PokemonExtra | null;
  typesById: Record<string, PokeType>;
}) {
  const { t } = useI18n();
  if (!extra || !extra.forms.length) return null;
  return (
    <section className="card animate-fadein">
      <h2 className="section-title mb-3">{t("forms.title")}</h2>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {extra.forms.map((f) => (
          <FormCard key={f.id} form={f} typesById={typesById} />
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------- movimientos ------------------------------ */

const METODOS: LearnMethod[] = ["level", "machine", "tutor", "egg"];

export function Learnset({ extra }: { extra: PokemonExtra | null }) {
  const { t, name } = useI18n();
  const moves = usePorId<MoveSummary>(api.moves.list);
  const options = useSessionOptions();
  const [metodo, setMetodo] = useState<LearnMethod>("level");

  const porMetodo = useMemo(() => {
    const grupos: Record<LearnMethod, { move: MoveSummary; level: number | null }[]> = {
      level: [],
      machine: [],
      tutor: [],
      egg: [],
    };
    if (!extra) return grupos;
    for (const e of extra.moves) {
      const move = moves.get(e.move_id);
      if (move && grupos[e.method]) grupos[e.method].push({ move, level: e.level });
    }
    grupos.level.sort((a, b) => (a.level || 0) - (b.level || 0));
    for (const m of ["machine", "tutor", "egg"] as const) {
      grupos[m].sort((a, b) => name(a.move).localeCompare(name(b.move)));
    }
    return grupos;
  }, [extra, moves, name]);

  const total = METODOS.reduce((n, m) => n + porMetodo[m].length, 0);
  if (!extra || moves.size === 0 || total === 0) return null;

  const activo = porMetodo[metodo].length ? metodo : METODOS.find((m) => porMetodo[m].length) || "level";
  const filas = porMetodo[activo];

  return (
    <section className="card animate-fadein">
      <h2 className="section-title mb-3">{t("learnset.title")}</h2>

      {options.any_move && <p className="notice mb-3 text-sm">{t("learnset.anyMove")}</p>}

      <div role="tablist" aria-label={t("learnset.title")} className="mb-3 flex flex-wrap gap-1.5">
        {METODOS.filter((m) => porMetodo[m].length).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={m === activo}
            onClick={() => setMetodo(m)}
            className={`pressable min-h-[2.75rem] rounded-full px-3.5 text-sm ${
              m === activo ? "bg-accent/20 font-medium text-ink" : "bg-hover text-ink-soft hover:text-ink"
            }`}
          >
            {t(`learnset.method.${m}`)}
            <span className="ml-1.5 tabular-nums text-ink-soft">{porMetodo[m].length}</span>
          </button>
        ))}
      </div>

      <ul className="max-h-[26rem] divide-y divide-hover overflow-auto pr-1" role="tabpanel">
        {filas.map(({ move, level }) => (
          <li key={move.id}>
            <Link
              to={`/movimiento/${move.id}`}
              className="flex min-h-[2.75rem] items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-hover"
            >
              {activo === "level" && (
                <span className="w-9 shrink-0 text-right font-mono text-xs text-ink-soft tabular-nums">
                  {t("learnset.levelShort", { level: level ?? 1 })}
                </span>
              )}
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: move.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 break-words text-sm text-ink">{name(move)}</span>
              <span className="shrink-0 text-xs text-ink-soft">{t(`category.${move.category}`)}</span>
              <span className="w-8 shrink-0 text-right font-mono text-xs text-ink tabular-nums">
                {move.power ?? "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------- quién aprende un movimiento (inversa) ----------------- */

const PRIMEROS = 24;

export function MoveLearnersSection({ moveId }: { moveId: number }) {
  const { t, name } = useI18n();
  const pokemon = usePorId<PokemonSummary>(api.pokemon.list);
  const options = useSessionOptions();
  const [ids, setIds] = useState<number[] | null>(null);
  const [todos, setTodos] = useState(false);

  useEffect(() => {
    setIds(null);
    setTodos(false);
    let cancelado = false;
    api.extra
      .move(moveId)
      .then((d) => {
        if (cancelado) return;
        // Un Pokémon puede aprenderlo por varios métodos: aquí cuenta una vez.
        setIds([...new Set(d.pokemon.map((p) => p.pokemon_id))]);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [moveId]);

  const lista = useMemo(
    () => (ids || []).map((id) => pokemon.get(id)).filter((p): p is PokemonSummary => Boolean(p)),
    [ids, pokemon]
  );
  if (!lista.length) return null;
  const visibles = todos ? lista : lista.slice(0, PRIMEROS);

  return (
    <section className="card animate-fadein">
      <h2 className="section-title mb-3">
        {t("learnset.learnedBy")}
        <span className="ml-2 font-normal tabular-nums text-ink-soft/70">{lista.length}</span>
      </h2>
      {options.any_move && <p className="notice mb-3 text-sm">{t("learnset.anyMove")}</p>}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(7rem,100%),1fr))] gap-2">
        {visibles.map((p) => (
          <li key={p.id}>
            <Link to={`/pokemon/${p.id}`} className="card-link flex h-full flex-col items-center gap-0.5 p-2 text-center">
              <PokemonSprite dex={p.dex} nombre={name(p)} className="h-12 w-12" />
              <span className="w-full break-words text-xs font-medium text-ink">{name(p)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {lista.length > PRIMEROS && (
        <button type="button" onClick={() => setTodos((v) => !v)} className="btn-ghost mt-3" aria-expanded={todos}>
          {todos ? t("common.showLess") : t("common.showAll", { count: lista.length })}
        </button>
      )}
    </section>
  );
}
