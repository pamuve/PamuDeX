/**
 * PamuDeX — Tareas 4.1 a 4.4
 * Página /datos: descarga del dataset en JSON y CSV, global o por sesión.
 *
 * Las descargas son enlaces `<a download>` directos a /api/export en vez de
 * fetch + Blob: así el navegador se encarga del Content-Disposition y del
 * nombre de archivo, y funciona igual en el móvil, donde crear un objectURL y
 * simular un clic es poco fiable.
 *
 * La importación (4.3 y 4.4) vive en components/ImportPanel.tsx.
 */

import { useEffect, useState } from "react";
import { Download, FileJson, Sheet, Database, Loader2 } from "lucide-react";
import { sessionsApi, type Session } from "../lib/apiSession";
import { useActiveSession } from "../lib/session";
import { useI18n } from "../i18n";
import { inputClass } from "../components/forms/FormField";
import ImportPanel from "../components/ImportPanel";

const ENTITIES = ["pokemon", "moves", "abilities", "types"] as const;
type Entity = (typeof ENTITIES)[number];

export default function ImportExport() {
  const { t } = useI18n();
  const [activeId] = useActiveSession();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null = dataset global. Arranca en la sesión activa, que es lo que el
  // usuario está mirando en el resto de la app.
  const [selected, setSelected] = useState<number | null>(activeId);

  useEffect(() => {
    let alive = true;
    sessionsApi
      .list()
      .then((list) => {
        if (!alive) return;
        setSessions(list);
        // Si la sesión activa ya no existe, se cae al dataset global.
        setSelected((current) => (list.some((s) => s.id === current) ? current : null));
      })
      .catch(() => alive && setError(t("data.loadError")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [t]);

  const query = selected === null ? "" : `?session=${selected}`;
  const csvHref = (entity: Entity) =>
    `/api/export/csv?entity=${entity}${selected === null ? "" : `&session=${selected}`}`;

  const currentName =
    selected === null ? t("data.global") : sessions.find((s) => s.id === selected)?.name || "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">{t("data.title")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t("data.subtitle")}</p>
      </header>

      {error && (
        <p className="rounded-xl2 bg-panel p-4 text-sm text-ink-soft shadow-card">{error}</p>
      )}

      <section className="rounded-xl2 bg-panel p-4 shadow-card animate-fadein">
        <label htmlFor="data-session" className="mb-2 block text-sm font-medium text-ink">
          {t("data.sourceLabel")}
        </label>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {t("data.loading")}
          </p>
        ) : (
          <>
            <select
              id="data-session"
              className={inputClass}
              value={selected === null ? "" : String(selected)}
              onChange={(e) => setSelected(e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">{t("data.global")}</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-ink-soft">
              {selected === null ? t("data.globalHint") : t("data.sessionHint", { name: currentName })}
            </p>
          </>
        )}
      </section>

      <section className="rounded-xl2 bg-panel p-4 shadow-card animate-fadein">
        <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-ink-soft">
          <FileJson size={16} aria-hidden="true" />
          {t("data.jsonTitle")}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">{t("data.jsonHint")}</p>
        <a
          href={`/api/export/json${query}`}
          download
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-hover px-4 py-2
                     text-sm font-medium text-ink transition hover:brightness-125
                     focus:outline-none focus:ring-2 focus:ring-ink-soft/40"
        >
          <Download size={16} aria-hidden="true" />
          {t("data.downloadJson")}
        </a>
      </section>

      <section className="rounded-xl2 bg-panel p-4 shadow-card animate-fadein">
        <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-ink-soft">
          <Sheet size={16} aria-hidden="true" />
          {t("data.csvTitle")}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">{t("data.csvHint")}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ENTITIES.map((entity) => (
            <a
              key={entity}
              href={csvHref(entity)}
              download
              /* `px-2 sm:px-3` y `flex-wrap`: en dos columnas a 4" con el texto
                 al 130% (8.1), «Movimientos» más el icono y el relleno se
                 pasaban de la celda. Ahora la etiqueta baja bajo el icono en
                 vez de salirse; a tamaño normal siguen cabiendo en una línea. */
              className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-lg border border-hover
                         px-2 sm:px-3 py-2 text-sm text-ink-soft transition hover:bg-hover hover:text-ink
                         focus:outline-none focus:ring-2 focus:ring-ink-soft/40"
            >
              <Download size={14} aria-hidden="true" />
              {t(`editor.tabs.${entity}`)}
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-xl2 bg-panel p-4 shadow-card animate-fadein">
        <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-ink-soft">
          <Database size={16} aria-hidden="true" />
          {t("data.sqliteTitle")}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">{t("data.sqliteHint")}</p>
        <a
          href={`/api/export/sqlite${query}`}
          download
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-hover px-4 py-2
                     text-sm font-medium text-ink transition hover:brightness-125
                     focus:outline-none focus:ring-2 focus:ring-ink-soft/40"
        >
          <Download size={16} aria-hidden="true" />
          {t("data.downloadSqlite")}
        </a>
      </section>

      <ImportPanel sessionId={selected} />
    </div>
  );
}
