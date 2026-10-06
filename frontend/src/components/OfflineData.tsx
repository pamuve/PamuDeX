/**
 * PamuDeX — Tarea 8.4
 * Sección de `/ajustes`: datos sin conexión.
 *
 * POR QUÉ HAY UN BOTÓN SI LA CACHÉ SE LLENA SOLA
 * ..............................................
 * Navegando se cachea lo que se visita, y nada más: quien solo ha abierto la
 * portada tiene tipos y Pokémon, pero se queda sin movimientos ni habilidades
 * en cuanto pierde la cobertura. El botón es para el momento en que uno SABE
 * que va a quedarse sin conexión —un viaje, el metro— y quiere dejarlo todo
 * descargado a propósito. Por eso enseña también cuándo fue la última vez.

 */

import { useCallback, useEffect, useState } from "react";
import { CloudDownload, Loader2, Trash2 } from "lucide-react";
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
import { useI18n } from "../i18n";

export function OfflineData() {
  const { t, lang } = useI18n();

  const [ultima, setUltima] = useState<number | null>(null);
  const [guardadas, setGuardadas] = useState(0);
  const [progreso, setProgreso] = useState<ProgresoSync | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    setUltima(await ultimaSincronizacion());
    setGuardadas((await claves()).length);
  }, []);

  useEffect(() => {
    refrescar();
    const onCache = () => refrescar();
    window.addEventListener(CACHE_EVENT, onCache);
    return () => window.removeEventListener(CACHE_EVENT, onCache);
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
  const sincronizando = progreso !== null;
  const porcentaje = progreso ? Math.round((progreso.hechos / progreso.total) * 100) : 0;

  return (
    <section className="card animate-fadein">
      <h2 className="section-title mb-1 flex items-center gap-2">
        <CloudDownload size={14} aria-hidden="true" />
        {t("offline.title")}
      </h2>
      <p className="text-ink-soft text-xs mb-3">{t("offline.hint")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={descargar}
          disabled={sincronizando}
          className="btn-secondary"
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
            className="btn-ghost"
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
              className="h-full bg-success transition-[width] duration-200"
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

    </section>
  );
}
