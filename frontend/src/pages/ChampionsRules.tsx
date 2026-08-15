/**
 * PamuDeX — Tarea 6.1
 * Página /champions/reglas: crear conjuntos de reglas de Pokémon Champions y
 * marcar qué contenido es legal.
 *
 * «SIN RESTRICCIÓN» NO ES LO MISMO QUE «NADA PERMITIDO»
 * -----------------------------------------------------
 * Es la decisión de diseño de la tarea y aquí se ve en la interfaz: cada
 * entidad tiene un interruptor entre las dos formas. Un conjunto nuevo nace sin
 * restricciones (permite todo el catálogo), porque si «vacío» significara «nada
 * permitido» habría que marcar 1025 casillas antes de que el modo sirviera para
 * algo. En el backend eso es `null` frente a `[]` (ver `lib/championsFilter.js`).
 *
 * POR QUÉ NO SE GUARDA CASILLA A CASILLA
 * --------------------------------------
 * Marcar contenido es una faena de decenas o cientos de clics. Guardar en cada
 * uno sería una petición por casilla y dejaría el conjunto en estados a medias
 * si se corta la red. Se edita un borrador local y se guarda cuando el usuario
 * lo dice, con aviso de cambios sin guardar.
 *
 * POR QUÉ SOLO SE PINTAN 200 FILAS
 * --------------------------------
 * Los objetos son 2151 y los movimientos 901. Pintar miles de casillas a la vez
 * atasca el navegador en un móvil, y no hay librería de virtualización en el
 * proyecto (ni interesa añadir una dependencia por esto). Se pinta un tope y se
 * dice cuántas quedan fuera; para eso están el buscador y las acciones en
 * bloque, que operan sobre TODO lo filtrado, no solo sobre lo visible.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import {
  championsApi,
  catalogApi,
  MULTIPLIER_KEYS,
  type ChampionsAllowed,
  type ChampionsEntity,
  type ChampionsMultipliers,
  type ChampionsRules,
  type ChampionsRulesSummary,
  type MultiplierKey,
} from "../lib/apiSession";
import { useI18n } from "../i18n";

/** Cuántas filas se pintan como mucho. Ver la cabecera. */
const MAX_VISIBLE = 200;

const ENTITIES: ChampionsEntity[] = ["pokemon", "moves", "abilities", "items"];

/** Fila del catálogo, ya normalizada sea cual sea la entidad. */
interface Fila {
  id: number;
  label: string;
  sublabel?: string;
  color?: string;
}

export default function ChampionsRules() {
  const { t, lang } = useI18n();

  const [list, setList] = useState<ChampionsRulesSummary[]>([]);
  const [selected, setSelected] = useState<ChampionsRules | null>(null);
  const [entity, setEntity] = useState<ChampionsEntity>("pokemon");

  // Borrador local: lo que se está editando y todavía no se ha guardado.
  const [draft, setDraft] = useState<ChampionsAllowed | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftMultipliers, setDraftMultipliers] = useState<ChampionsMultipliers | null>(null);

  const [catalogs, setCatalogs] = useState<Partial<Record<ChampionsEntity, Fila[]>>>({});
  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nombre = useCallback(
    (o: { name_es: string; name_en: string }) => (lang === "en" ? o.name_en : o.name_es),
    [lang]
  );

  /* --------------------------- carga de datos --------------------------- */

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setList(await championsApi.list());
    } catch {
      setError(t("champions.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  /** Abre un conjunto y prepara su borrador. */
  async function abrir(id: number) {
    setBusy(true);
    setError(null);
    try {
      const reglas = await championsApi.get(id);
      setSelected(reglas);
      setDraft(reglas.allowed);
      setDraftName(reglas.name);
      setDraftMultipliers(reglas.multipliers);
      setQuery("");
      setConfirmDelete(false);
    } catch {
      setError(t("champions.loadError"));
    } finally {
      setBusy(false);
    }
  }

  // El catálogo de la pestaña activa se pide una sola vez y se queda cacheado.
  // Se piden los datos GLOBALES (`catalogApi` va con `session: false`): Champions
  // y las sesiones de ROM Hack son modos excluyentes.
  useEffect(() => {
    if (!selected || catalogs[entity]) return;
    let cancelled = false;

    async function cargar() {
      try {
        let filas: Fila[] = [];
        if (entity === "pokemon") {
          const list = await catalogApi.pokemonList();
          filas = list.map((p) => ({
            id: p.id,
            label: nombre(p),
            sublabel: `#${String(p.dex).padStart(3, "0")}`,
          }));
        } else if (entity === "moves") {
          const list = await catalogApi.moves();
          filas = list.map((m) => ({
            id: m.id,
            label: nombre(m),
            sublabel: String(m.type_id),
            color: (m as { color?: string }).color,
          }));
        } else if (entity === "abilities") {
          const list = await catalogApi.abilities();
          filas = list.map((a) => ({ id: a.id, label: nombre(a) }));
        } else {
          const list = await catalogApi.items();
          filas = list.map((i) => ({
            id: i.id,
            label: nombre(i),
            sublabel: i.category || undefined,
          }));
        }
        if (!cancelled) setCatalogs((prev) => ({ ...prev, [entity]: filas }));
      } catch {
        if (!cancelled) setError(t("champions.catalogError"));
      }
    }

    cargar();
    return () => {
      cancelled = true;
    };
  }, [entity, selected, catalogs, nombre, t]);

  /* ------------------------------ borrador ------------------------------ */

  const catalogo = catalogs[entity];
  const permitidos = draft ? draft[entity] : null;
  const restringido = permitidos !== null;

  /** Set para consultar la pertenencia sin recorrer el array en cada fila. */
  const marcados = useMemo(
    () => (permitidos === null ? null : new Set(permitidos)),
    [permitidos]
  );

  const filtradas = useMemo(() => {
    if (!catalogo) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return catalogo;
    return catalogo.filter(
      (f) =>
        f.label.toLowerCase().includes(needle) ||
        String(f.sublabel || "").toLowerCase().includes(needle) ||
        String(f.id) === needle
    );
  }, [catalogo, query]);

  const sucio =
    selected !== null &&
    draft !== null &&
    (draftName !== selected.name ||
      ENTITIES.some((e) => JSON.stringify(draft[e]) !== JSON.stringify(selected.allowed[e])) ||
      MULTIPLIER_KEYS.some(
        (k) => (draftMultipliers ? draftMultipliers[k] : null) !== selected.multipliers[k]
      ));

  /** Cambia un multiplicador del borrador. Vacío o no numérico se ignora. */
  function setMultiplicador(key: MultiplierKey, valor: string) {
    const numero = Number(valor);
    if (valor.trim() === "" || !Number.isFinite(numero) || numero < 0) return;
    setDraftMultipliers((prev) => (prev ? { ...prev, [key]: numero } : prev));
  }

  function setEntidad(valor: number[] | null) {
    setDraft((prev) => (prev ? { ...prev, [entity]: valor } : prev));
  }

  function alternar(id: number) {
    if (permitidos === null) return;
    const set = new Set(permitidos);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setEntidad([...set].sort((a, b) => a - b));
  }

  /** Acciones en bloque: operan sobre TODO lo filtrado, no solo lo visible. */
  function marcarFiltradas(marcar: boolean) {
    if (permitidos === null) return;
    const set = new Set(permitidos);
    for (const fila of filtradas) {
      if (marcar) set.add(fila.id);
      else set.delete(fila.id);
    }
    setEntidad([...set].sort((a, b) => a - b));
  }

  /* ------------------------------- guardar ------------------------------ */

  async function guardar() {
    if (!selected || !draft) return;
    setBusy(true);
    setError(null);
    try {
      const actualizado = await championsApi.update(selected.id, {
        name: draftName.trim() || selected.name,
        allowed: draft,
        multipliers: draftMultipliers,
      });
      setSelected(actualizado);
      setDraft(actualizado.allowed);
      setDraftName(actualizado.name);
      setDraftMultipliers(actualizado.multipliers);
      setList((prev) =>
        prev.map((r) =>
          r.id === actualizado.id
            ? { id: actualizado.id, name: actualizado.name, counts: actualizado.counts }
            : r
        )
      );
    } catch {
      setError(t("champions.saveError"));
    } finally {
      setBusy(false);
    }
  }

  function descartar() {
    if (!selected) return;
    setDraft(selected.allowed);
    setDraftName(selected.name);
    setDraftMultipliers(selected.multipliers);
  }

  /**
   * Restablece los multiplicadores a los valores de siempre.
   *
   * Es una acción propia con su petición, no un cambio del borrador: el
   * frontend no conoce los valores por defecto del proyecto a propósito (los
   * rellena el backend), así que la única forma de volver a ellos es pedirlo
   * con `multipliers: null`. Los cambios pendientes de nombre o de contenido
   * siguen en el borrador — el PUT es parcial y no los toca.
   */
  async function restablecerMultiplicadores() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const actualizado = await championsApi.update(selected.id, { multipliers: null });
      setSelected(actualizado);
      setDraftMultipliers(actualizado.multipliers);
    } catch {
      setError(t("champions.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function crear() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const creado = await championsApi.create(name);
      setList((prev) =>
        [...prev, { id: creado.id, name: creado.name, counts: creado.counts }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setSelected(creado);
      setDraft(creado.allowed);
      setDraftName(creado.name);
      setDraftMultipliers(creado.multipliers);
      setCreating(false);
      setNewName("");
    } catch {
      setError(t("champions.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function borrar() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await championsApi.remove(selected.id);
      setList((prev) => prev.filter((r) => r.id !== selected.id));
      setSelected(null);
      setDraft(null);
      setDraftMultipliers(null);
      setConfirmDelete(false);
    } catch {
      setError(t("champions.deleteError"));
    } finally {
      setBusy(false);
    }
  }

  /* -------------------------------- render ------------------------------ */

  const visibles = filtradas.slice(0, MAX_VISIBLE);
  const ocultas = filtradas.length - visibles.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start gap-3 flex-wrap">
        {/* `min(14rem,100%)`: el mínimo evita que el título y el botón se
            partan en escritorio, pero al 130% de escalado (8.1) 14rem son
            291px y no caben en una pantalla de 320. El `min()` cede primero. */}
        <div className="flex-1 min-w-[min(14rem,100%)]">
          <h1 className="font-display font-bold text-2xl text-ink flex items-center gap-2">
            <Shield size={22} aria-hidden="true" />
            {t("champions.title")}
          </h1>
          <p className="text-ink-soft text-sm mt-1">{t("champions.subtitle")}</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 bg-panel hover:bg-hover text-ink rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            <Plus size={16} aria-hidden="true" />
            {t("champions.new")}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-panel border border-hover rounded-xl2 p-3 flex items-start gap-2 text-sm text-ink animate-fadein">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {creating && (
        <div className="bg-panel rounded-xl2 shadow-card p-4 animate-fadein">
          <label className="block text-sm text-ink-soft mb-1" htmlFor="champions-name">
            {t("champions.nameLabel")}
          </label>
          <input
            id="champions-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("champions.namePlaceholder")}
            maxLength={60}
            autoFocus
            className="w-full bg-base border border-hover rounded-lg px-3 py-2.5 text-ink placeholder:text-ink-soft/50 focus:outline-none focus:border-ink-soft"
          />
          <p className="text-ink-soft text-xs mt-2">{t("champions.newHint")}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={crear}
              disabled={!newName.trim() || busy}
              className="flex items-center gap-1.5 bg-hover text-ink rounded-lg px-4 py-2.5 text-sm disabled:opacity-50 hover:brightness-125 transition"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {t("champions.create")}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-4 py-2.5 text-sm transition-colors"
            >
              {t("profiles.cancel")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-ink-soft py-12">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          {t("champions.loading")}
        </div>
      ) : list.length === 0 && !creating ? (
        <div className="bg-panel rounded-xl2 shadow-card p-8 text-center animate-fadein">
          <Shield size={36} className="mx-auto text-ink-soft mb-3" aria-hidden="true" />
          <p className="text-ink font-medium mb-1">{t("champions.empty")}</p>
          <p className="text-ink-soft text-sm">{t("champions.emptyHint")}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[16rem_1fr] gap-4 items-start">
          {/* Conjuntos de reglas ------------------------------------------ */}
          <nav className="bg-panel rounded-xl2 shadow-card p-2 animate-fadein">
            <ul className="space-y-1">
              {list.map((reglas) => {
                const activo = selected !== null && selected.id === reglas.id;
                return (
                  <li key={reglas.id}>
                    <button
                      onClick={() => abrir(reglas.id)}
                      aria-current={activo ? "true" : undefined}
                      className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        activo ? "bg-hover text-ink" : "text-ink-soft hover:bg-hover hover:text-ink"
                      }`}
                    >
                      <span className="block truncate">{reglas.name}</span>
                      <span className="block text-[11px] text-ink-soft/80 mt-0.5">
                        {ENTITIES.filter((e) => reglas.counts[e] !== null).length === 0
                          ? t("champions.noLimits")
                          : ENTITIES.filter((e) => reglas.counts[e] !== null)
                              .map((e) => `${t(`champions.entity.${e}`)}: ${reglas.counts[e]}`)
                              .join(" · ")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Editor -------------------------------------------------------- */}
          {!selected || !draft ? (
            <div className="bg-panel rounded-xl2 shadow-card p-8 text-center text-ink-soft animate-fadein">
              {t("champions.pick")}
            </div>
          ) : (
            <section className="space-y-4 animate-fadein">
              <div className="bg-panel rounded-xl2 shadow-card p-4">
                <label className="block text-sm text-ink-soft mb-1" htmlFor="champions-rename">
                  {t("champions.nameLabel")}
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="champions-rename"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    maxLength={60}
                    className="flex-1 min-w-[10rem] bg-base border border-hover rounded-lg px-3 py-2.5 text-ink focus:outline-none focus:border-ink-soft"
                  />
                  <button
                    onClick={guardar}
                    disabled={!sucio || busy}
                    className="flex items-center gap-1.5 bg-hover text-ink rounded-lg px-4 py-2.5 text-sm disabled:opacity-50 hover:brightness-125 transition"
                  >
                    {busy ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Save size={16} aria-hidden="true" />
                    )}
                    {t("champions.save")}
                  </button>
                  {sucio && (
                    <button
                      onClick={descartar}
                      disabled={busy}
                      className="flex items-center gap-1.5 text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-3 py-2.5 text-sm transition-colors"
                    >
                      <X size={16} aria-hidden="true" />
                      {t("champions.discard")}
                    </button>
                  )}
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1.5 text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-3 py-2.5 text-sm transition-colors"
                      title={t("champions.delete")}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-ink">{t("champions.confirmDelete")}</span>
                      <button
                        onClick={borrar}
                        disabled={busy}
                        className="bg-hover text-ink rounded-lg px-3 py-2 disabled:opacity-50"
                      >
                        {t("profiles.delete")}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="text-ink-soft hover:text-ink rounded-lg px-2 py-2"
                      >
                        {t("profiles.cancel")}
                      </button>
                    </span>
                  )}
                </div>
                {sucio && (
                  <p role="status" className="text-ink-soft text-xs mt-2">
                    {t("champions.unsaved")}
                  </p>
                )}
              </div>

              {/* Pestañas de entidad */}
              <div className="flex flex-wrap gap-1.5" role="tablist">
                {ENTITIES.map((e) => (
                  <button
                    key={e}
                    role="tab"
                    aria-selected={entity === e}
                    onClick={() => {
                      setEntity(e);
                      setQuery("");
                    }}
                    className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                      entity === e ? "bg-hover text-ink" : "bg-panel text-ink-soft hover:text-ink"
                    }`}
                  >
                    {t(`champions.entity.${e}`)}
                    <span className="ml-1.5 text-[11px] text-ink-soft">
                      {draft[e] === null ? "∞" : draft[e]!.length}
                    </span>
                  </button>
                ))}
              </div>

              <div className="bg-panel rounded-xl2 shadow-card p-4">
                {/* Sin restricción / restringir */}
                <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-hover">
                  <button
                    onClick={() => setEntidad(restringido ? null : [])}
                    role="switch"
                    aria-checked={restringido}
                    className="flex items-center gap-2 bg-base hover:bg-hover rounded-lg px-3 py-2 text-sm text-ink transition-colors"
                  >
                    <span
                      className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${
                        restringido ? "bg-[#F08030]" : "bg-hover"
                      }`}
                      aria-hidden="true"
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-ink transition-transform ${
                          restringido ? "translate-x-4" : ""
                        }`}
                      />
                    </span>
                    {restringido ? t("champions.restricted") : t("champions.unrestricted")}
                  </button>
                  <p className="text-ink-soft text-xs flex-1 min-w-[12rem]">
                    {restringido
                      ? t("champions.restrictedHint", {
                          n: permitidos!.length,
                          total: catalogo ? catalogo.length : 0,
                        })
                      : t("champions.unrestrictedHint")}
                  </p>
                </div>

                {!restringido ? null : !catalogo ? (
                  <div className="flex items-center justify-center gap-2 text-ink-soft py-10">
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    {t("champions.loadingCatalog")}
                  </div>
                ) : (
                  <>
                    <div className="relative mt-3">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
                        aria-hidden="true"
                      />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("champions.search")}
                        aria-label={t("champions.search")}
                        className="w-full bg-base border border-hover rounded-lg pl-9 pr-3 py-2.5 text-ink placeholder:text-ink-soft/50 focus:outline-none focus:border-ink-soft"
                      />
                    </div>

                    {/* Acciones en bloque sobre TODO lo filtrado */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        onClick={() => marcarFiltradas(true)}
                        className="text-xs bg-base hover:bg-hover text-ink rounded-lg px-3 py-2 transition-colors"
                      >
                        {t("champions.selectFiltered", { n: filtradas.length })}
                      </button>
                      <button
                        onClick={() => marcarFiltradas(false)}
                        className="text-xs bg-base hover:bg-hover text-ink rounded-lg px-3 py-2 transition-colors"
                      >
                        {t("champions.clearFiltered", { n: filtradas.length })}
                      </button>
                    </div>

                    <ul className="mt-3 space-y-1 max-h-[28rem] overflow-y-auto">
                      {visibles.map((fila) => {
                        const activa = marcados !== null && marcados.has(fila.id);
                        return (
                          <li key={fila.id}>
                            <label className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-hover cursor-pointer">
                              <input
                                type="checkbox"
                                checked={activa}
                                onChange={() => alternar(fila.id)}
                                className="w-4 h-4 shrink-0 accent-[#78C850]"
                              />
                              {fila.color && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: fila.color }}
                                  aria-hidden="true"
                                />
                              )}
                              <span className="text-ink text-sm truncate">{fila.label}</span>
                              {fila.sublabel && (
                                <span className="text-ink-soft text-xs ml-auto shrink-0">
                                  {fila.sublabel}
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>

                    {filtradas.length === 0 && (
                      <p className="text-ink-soft text-sm text-center py-6">
                        {t("champions.noMatches")}
                      </p>
                    )}
                    {ocultas > 0 && (
                      <p className="text-ink-soft text-xs text-center pt-3 border-t border-hover mt-2">
                        {t("champions.tooMany", { n: ocultas })}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Multiplicadores del modo (Tarea 6.2) --------------------- */}
              <div className="bg-panel rounded-xl2 shadow-card p-4">
                <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-1">
                  {t("champions.multipliers")}
                </h2>
                <p className="text-ink-soft text-xs mb-3">{t("champions.multipliersHint")}</p>

                <div className="grid sm:grid-cols-2 gap-2">
                  {MULTIPLIER_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 bg-base rounded-lg px-3 py-2"
                      htmlFor={`mult-${key}`}
                    >
                      <span className="text-ink text-sm flex-1 truncate">
                        {t(`effectiveness.${key}`)}
                      </span>
                      <span className="text-ink-soft font-mono text-sm" aria-hidden="true">
                        x
                      </span>
                      <input
                        id={`mult-${key}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={99}
                        step={0.25}
                        value={draftMultipliers ? draftMultipliers[key] : ""}
                        onChange={(e) => setMultiplicador(key, e.target.value)}
                        className="w-20 bg-panel border border-hover rounded-lg px-2 py-1.5 text-ink text-sm font-mono text-right focus:outline-none focus:border-ink-soft"
                      />
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {selected.multipliers_custom && (
                    <button
                      onClick={restablecerMultiplicadores}
                      disabled={busy}
                      className="flex items-center gap-1.5 text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-50"
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      {t("champions.multipliersReset")}
                    </button>
                  )}
                  <p className="text-ink-soft text-xs flex-1 min-w-[12rem]">
                    {selected.multipliers_custom
                      ? t("champions.multipliersCustom")
                      : t("champions.multipliersDefault")}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      <p className="text-ink-soft text-xs">
        {t("champions.enterHint")}{" "}
        <Link to="/champions" className="underline hover:text-ink">
          {t("championsHome.title")}
        </Link>
      </p>
    </div>
  );
}
