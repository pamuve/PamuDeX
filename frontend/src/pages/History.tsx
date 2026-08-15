/**
 * PamuDeX — Tarea 5.4
 * Página /historial: las últimas fichas que ha abierto el perfil activo.
 *
 * LOS NOMBRES SE RESUELVEN AQUÍ, NO EN EL BACKEND
 * -----------------------------------------------
 * Igual que /favoritos: `/api/history` devuelve solo referencias y los nombres
 * salen de los listados que la app ya pide (y que el Service Worker cachea),
 * así que pasan por `lib/api.ts` y **respetan los overrides de la sesión de ROM
 * Hack activa**. Solo se piden los listados de los tipos que aparecen en el
 * historial.
 *
 * El agrupado por día se calcula en el cliente porque la hora hay que pasarla a
 * la zona local de todas formas (SQLite guarda UTC sin marca de zona).
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { History as HistoryIcon, Loader2, Trash2, UserCircle2, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { useHistory, clearHistory, parseViewedAt, type HistoryType } from "../lib/history";
import { useActiveProfile } from "../lib/profile";
import { useI18n } from "../i18n";
import type { PokeType } from "../types";

const ROUTE: Record<HistoryType, string> = {
  pokemon: "/pokemon",
  move: "/movimiento",
  ability: "/habilidad",
  type: "/tipo",
};

/** Nombre resuelto de una entidad, indexado por `tipo:referencia`. */
type Nombres = Record<string, { name: string; color?: string }>;

export default function History() {
  const { t, lang } = useI18n();
  const [profile] = useActiveProfile();
  const { items, ready, error } = useHistory();

  const [nombres, setNombres] = useState<Nombres>({});
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [fallo, setFallo] = useState(false);

  /** Qué tipos aparecen, para pedir solo esos listados. */
  const presentes = useMemo(() => {
    const set = new Set<HistoryType>();
    for (const item of items) set.add(item.entity_type as HistoryType);
    return [...set].sort().join(",");
  }, [items]);

  useEffect(() => {
    if (!presentes) return;
    let cancelled = false;

    const tipos = presentes.split(",") as HistoryType[];
    const nombre = (o: { name_es: string; name_en: string }) =>
      lang === "en" ? o.name_en : o.name_es;

    async function resolver() {
      const next: Nombres = {};
      const tareas: Promise<void>[] = [];

      if (tipos.includes("pokemon")) {
        tareas.push(
          api.pokemon.list().then((list) => {
            for (const p of list) next[`pokemon:${p.id}`] = { name: nombre(p) };
          })
        );
      }
      if (tipos.includes("move")) {
        tareas.push(
          api.moves.list().then((list) => {
            for (const m of list) next[`move:${m.id}`] = { name: nombre(m), color: m.color };
          })
        );
      }
      if (tipos.includes("ability")) {
        tareas.push(
          api.abilities.list().then((list) => {
            for (const a of list) next[`ability:${a.id}`] = { name: nombre(a) };
          })
        );
      }
      if (tipos.includes("type")) {
        tareas.push(
          api.types.list().then((list: PokeType[]) => {
            for (const tp of list) next[`type:${tp.id}`] = { name: nombre(tp), color: tp.color };
          })
        );
      }

      try {
        await Promise.all(tareas);
      } catch {
        // Sin conexión y sin caché se muestran las referencias en crudo, que
        // siguen siendo enlaces válidos.
      }
      if (!cancelled) setNombres(next);
    }

    resolver();
    return () => {
      cancelled = true;
    };
  }, [presentes, lang]);

  /** Agrupado por día, ya en hora local y en el orden que llega (reciente primero). */
  const dias = useMemo(() => {
    const fmtDia = new Intl.DateTimeFormat(lang, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const hoy = new Date().toDateString();
    const ayer = new Date(Date.now() - 86400000).toDateString();

    const grupos: { key: string; label: string; items: typeof items }[] = [];
    for (const item of items) {
      const fecha = parseViewedAt(item.viewed_at);
      const key = fecha.toDateString();
      const label = key === hoy ? t("history.today") : key === ayer ? t("history.yesterday") : fmtDia.format(fecha);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.key === key) ultimo.items.push(item);
      else grupos.push({ key, label, items: [item] });
    }
    return grupos;
  }, [items, lang, t]);

  async function handleClear() {
    setBorrando(true);
    setFallo(false);
    try {
      await clearHistory();
      setConfirmando(false);
    } catch {
      setFallo(true);
    } finally {
      setBorrando(false);
    }
  }

  // Sin perfil no hay historial que enseñar.
  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <UserCircle2 size={40} className="mx-auto text-ink-soft mb-3" aria-hidden="true" />
        <h1 className="font-display font-bold text-2xl text-ink mb-2">{t("history.title")}</h1>
        <p className="text-ink-soft mb-5">{t("history.needProfile")}</p>
        <Link
          to="/perfiles"
          className="inline-block bg-panel hover:bg-hover text-ink rounded-lg px-5 py-2.5 text-sm transition-colors"
        >
          {t("profiles.choose")}
        </Link>
      </div>
    );
  }

  const fmtHora = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[12rem]">
          <h1 className="font-display font-bold text-2xl text-ink">{t("history.title")}</h1>
          <p className="text-ink-soft text-sm mt-1">
            {t("history.subtitle", { name: profile.name })}
          </p>
        </div>
        {items.length > 0 && !confirmando && (
          <button
            onClick={() => setConfirmando(true)}
            className="flex items-center gap-1.5 text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <Trash2 size={16} aria-hidden="true" />
            {t("history.clear")}
          </button>
        )}
      </div>

      {confirmando && (
        <div className="bg-panel rounded-xl2 shadow-card p-4 animate-fadein">
          <p className="text-ink text-sm font-medium">{t("history.confirmClear")}</p>
          <p className="text-ink-soft text-xs mt-1 mb-3">{t("history.confirmClearHint")}</p>
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              disabled={borrando}
              className="flex items-center gap-1.5 bg-hover text-ink rounded-lg px-4 py-2.5 text-sm disabled:opacity-50 hover:brightness-125 transition"
            >
              {borrando ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 size={16} aria-hidden="true" />
              )}
              {t("history.clear")}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              disabled={borrando}
              className="text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-4 py-2.5 text-sm transition-colors"
            >
              {t("profiles.cancel")}
            </button>
          </div>
        </div>
      )}

      {(error || fallo) && (
        <div className="bg-panel border border-hover rounded-xl2 p-3 flex items-start gap-2 text-sm text-ink animate-fadein">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t(fallo ? "history.clearError" : "history.loadError")}</span>
        </div>
      )}

      {!ready ? (
        <div className="flex items-center justify-center gap-2 text-ink-soft py-12">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          {t("history.loading")}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-panel rounded-xl2 shadow-card p-8 text-center animate-fadein">
          <HistoryIcon size={36} className="mx-auto text-ink-soft mb-3" aria-hidden="true" />
          <p className="text-ink font-medium mb-1">{t("history.empty")}</p>
          <p className="text-ink-soft text-sm">{t("history.emptyHint")}</p>
        </div>
      ) : (
        dias.map((dia) => (
          <section key={dia.key} className="animate-fadein">
            <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-3">
              {dia.label}
            </h2>
            <ul className="space-y-2">
              {dia.items.map((item) => {
                const tipo = item.entity_type as HistoryType;
                const resuelto = nombres[`${tipo}:${item.entity_ref}`];
                const ruta = ROUTE[tipo];
                return (
                  <li key={item.id}>
                    <Link
                      to={`${ruta}/${item.entity_ref}`}
                      className="flex items-center gap-3 bg-panel hover:bg-hover rounded-xl2 shadow-card px-4 py-3 transition-colors"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: resuelto?.color || "var(--color-ink-soft)" }}
                        aria-hidden="true"
                      />
                      <span className="text-ink text-sm truncate">
                        {resuelto ? resuelto.name : item.entity_ref}
                      </span>
                      <span className="text-ink-soft text-xs ml-auto shrink-0">
                        {t(`history.type.${tipo}`)}
                      </span>
                      <time
                        dateTime={parseViewedAt(item.viewed_at).toISOString()}
                        className="text-ink-soft text-xs font-mono shrink-0 w-12 text-right"
                      >
                        {fmtHora.format(parseViewedAt(item.viewed_at))}
                      </time>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
