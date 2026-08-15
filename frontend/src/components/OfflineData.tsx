/**
 * PamuDeX — Tarea 8.4
 * Sección de `/ajustes`: datos sin conexión y modo de depuración.
 *
 * POR QUÉ HAY UN BOTÓN SI LA CACHÉ SE LLENA SOLA
 * ..............................................
 * Navegando se cachea lo que se visita, y nada más: quien solo ha abierto la
 * portada tiene tipos y Pokémon, pero se queda sin movimientos ni habilidades
 * en cuanto pierde la cobertura. El botón es para el momento en que uno SABE
 * que va a quedarse sin conexión —un viaje, el metro— y quiere dejarlo todo
 * descargado a propósito. Por eso enseña también cuándo fue la última vez.
 *
 * EL MODO DE DEPURACIÓN NO ES DECORACIÓN
 * ......................................
 * El requisito del proyecto es un número concreto —menos de 100 ms para datos
 * ya cacheados— y sin enseñarlo no hay forma de saber si se cumple en el
 * aparato de cada uno. Está apagado por defecto y no gasta nada: las medidas se
 * toman siempre (son un `performance.now()`), esto solo las pinta.
 */

import { useCallback, useEffect, useState } from "react";
import { Activity, CloudDownload, Loader2, Trash2 } from "lucide-react";
import { descargarParaCache } from "../lib/api";
import {
  CACHE_EVENT,
  RUTAS_CATALOGO,
  borrarTodo,
  claves,
  sincronizar,
  ultimaSincronizacion,
  type ProgresoSync,
} from "../lib/localCache";
import { OBJETIVO_MS, PERF_EVENT, historial, limpiarMedidas, resumenLocal } from "../lib/perf";
import { useI18n } from "../i18n";

export function OfflineData() {
  const { t, lang } = useI18n();

  const [ultima, setUltima] = useState<number | null>(null);
  const [guardadas, setGuardadas] = useState(0);
  const [progreso, setProgreso] = useState<ProgresoSync | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [depuracion, setDepuracion] = useState(false);
  const [, repintar] = useState(0);

  const refrescar = useCallback(async () => {
    setUltima(await ultimaSincronizacion());
    setGuardadas((await claves()).length);
  }, []);

  useEffect(() => {
    refrescar();
    const onCache = () => refrescar();
    const onPerf = () => repintar((n) => n + 1);
    window.addEventListener(CACHE_EVENT, onCache);
    window.addEventListener(PERF_EVENT, onPerf);
    return () => {
      window.removeEventListener(CACHE_EVENT, onCache);
      window.removeEventListener(PERF_EVENT, onPerf);
    };
  }, [refrescar]);

  async function descargar() {
    setResultado(null);
    setProgreso({ hechos: 0, total: RUTAS_CATALOGO.length, actual: "" });
    const { ok, fallos } = await sincronizar(descargarParaCache, setProgreso);
    setProgreso(null);
    setResultado(
      fallos.length ? t("offline.syncPartial", { ok, total: RUTAS_CATALOGO.length }) : t("offline.syncDone")
    );
    await refrescar();
  }

  async function borrar() {
    await borrarTodo();
    setResultado(t("offline.cleared"));
    await refrescar();
  }

  const fecha = ultima
    ? new Date(ultima).toLocaleString(lang === "en" ? "en-GB" : "es-ES")
    : null;
  const medidas = historial();
  const resumen = resumenLocal();
  const sincronizando = progreso !== null;
  const porcentaje = progreso ? Math.round((progreso.hechos / progreso.total) * 100) : 0;

  return (
    <section className="bg-panel rounded-xl2 shadow-card p-5 animate-fadein">
      <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-1 flex items-center gap-2">
        <CloudDownload size={14} aria-hidden="true" />
        {t("offline.title")}
      </h2>
      <p className="text-ink-soft text-xs mb-3">{t("offline.hint")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={descargar}
          disabled={sincronizando}
          className="flex items-center gap-2 bg-base hover:bg-hover disabled:opacity-60
                     disabled:cursor-not-allowed rounded-lg px-4 py-2.5 text-sm text-ink transition-colors"
        >
          {sincronizando ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <CloudDownload size={16} aria-hidden="true" />
          )}
          {t("offline.download")}
        </button>

        {guardadas > 0 && (
          <button
            onClick={borrar}
            disabled={sincronizando}
            className="flex items-center gap-1.5 text-ink-soft hover:text-ink hover:bg-hover
                       disabled:opacity-60 rounded-lg px-3 py-2.5 text-sm transition-colors"
          >
            <Trash2 size={16} aria-hidden="true" />
            {t("offline.clear")}
          </button>
        )}
      </div>

      {/* Barra de progreso. `progressbar` con sus valores para que un lector de
          pantalla pueda decir por dónde va, no solo que «está cargando». */}
      {progreso && (
        <div className="mt-3">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progreso.total}
            aria-valuenow={progreso.hechos}
            aria-label={t("offline.download")}
            className="h-2 w-full overflow-hidden rounded-full bg-base"
          >
            <div
              className="h-full bg-[#78C850] transition-[width] duration-200"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            {t("offline.progress", { hechos: progreso.hechos, total: progreso.total })}
          </p>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-soft" role="status" aria-live="polite">
        {resultado ? `${resultado} · ` : ""}
        {fecha ? t("offline.lastSync", { date: fecha }) : t("offline.never")}
      </p>

      {/* Modo de depuración */}
      <div className="border-t border-hover mt-5 pt-4">
        <button
          onClick={() => setDepuracion((d) => !d)}
          aria-expanded={depuracion}
          className="flex items-center gap-2 text-sm text-ink-soft hover:text-ink transition-colors"
        >
          <Activity size={14} aria-hidden="true" />
          {t("offline.debug")}
        </button>

        {depuracion && (
          <div className="mt-3 animate-fadein">
            <p className="text-ink-soft text-xs mb-2">
              {t("offline.debugHint", { objetivo: OBJETIVO_MS })}
            </p>

            {resumen && (
              <p
                className={`text-sm mb-2 ${resumen.cumple ? "text-[#78C850]" : "text-[#F08030]"}`}
              >
                {t("offline.debugSummary", {
                  n: resumen.n,
                  media: resumen.media.toFixed(1),
                  peor: resumen.peor.toFixed(1),
                  objetivo: OBJETIVO_MS,
                })}
              </p>
            )}

            {medidas.length === 0 ? (
              <p className="text-ink-soft text-xs">{t("offline.debugEmpty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-ink-soft text-left">
                      <th className="py-1 pr-3 font-normal">{t("offline.colRoute")}</th>
                      <th className="py-1 pr-3 font-normal">{t("offline.colSource")}</th>
                      <th className="py-1 pr-3 font-normal text-right">{t("offline.colMs")}</th>
                      <th className="py-1 font-normal text-right">{t("offline.colSinceNav")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medidas.map((m, i) => (
                      <tr key={i} className="border-t border-hover">
                        <td className="py-1 pr-3 font-mono text-ink">{m.ruta}</td>
                        <td className="py-1 pr-3 text-ink-soft">
                          {m.origen === "local" ? t("offline.fromLocal") : t("offline.fromNetwork")}
                        </td>
                        <td
                          className={`py-1 pr-3 text-right font-mono ${
                            m.origen === "local" && m.ms >= OBJETIVO_MS ? "text-[#F08030]" : "text-ink"
                          }`}
                        >
                          {m.ms.toFixed(1)}
                        </td>
                        <td className="py-1 text-right font-mono text-ink-soft">
                          {m.desdeNavegacion.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {medidas.length > 0 && (
              <button
                onClick={limpiarMedidas}
                className="mt-2 text-xs text-ink-soft hover:text-ink underline"
              >
                {t("offline.debugClear")}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
