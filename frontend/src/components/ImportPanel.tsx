/**
 * PamuDeX — Tareas 4.3 y 4.4
 * Panel de importación: subir archivo → previsualizar → confirmar → aplicar.
 *
 * Nunca se aplica nada sin pasar antes por la previsualización, y el botón de
 * aplicar queda deshabilitado mientras haya errores de validación.
 *
 * El archivo se envía en crudo (`body: file`), sin multipart: el backend lo
 * recibe con `express.raw` y los metadatos viajan en la query. `apply` reenvía
 * el archivo porque el backend no guarda estado entre los dos pasos: vuelve a
 * validar desde cero, así que no se puede aplicar algo que no acabe de pasar la
 * validación.
 */

import { useRef, useState } from "react";
import { Upload, AlertTriangle, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { useI18n } from "../i18n";
import { inputClass, btnPrimary, btnGhost } from "./forms/FormField";

const ENTITIES = ["pokemon", "moves", "abilities", "types"] as const;

interface Resumen {
  added: number;
  updated: number;
  unchanged: number;
  total: number;
}
interface Preview {
  valid: boolean;
  errors: { message: string }[];
  warnings: { code: string; message: string }[];
  summary: Record<string, Resumen>;
  examples: Record<string, { added: { name: string }[]; updated: { name: string; fields: string[] }[] }>;
  error?: string;
  /** Detalle del error (cadena o lista), no confundir con `examples`. */
  detalle?: string[] | string;
}

type Modo = "merge" | "replace";

export default function ImportPanel({ sessionId }: { sessionId: number | null }) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [entity, setEntity] = useState<string>("pokemon");
  const [modo, setModo] = useState<Modo>("merge");
  const [confirmaReplace, setConfirmaReplace] = useState(false);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const esSqlite = Boolean(file && /\.sqlite$|\.db$/i.test(file.name));
  const esCsv = Boolean(file && /\.csv$/i.test(file.name));
  const destino = sessionId === null ? "global" : "session";

  function url(paso: "preview" | "apply") {
    const base = esSqlite ? `/api/import/sqlite/${paso}` : `/api/import/${paso}`;
    const p = new URLSearchParams({ target: destino, mode: modo });
    if (sessionId !== null) p.set("session", String(sessionId));
    if (!esSqlite) {
      p.set("format", esCsv ? "csv" : "json");
      if (esCsv) p.set("entity", entity);
    }
    return `${base}?${p}`;
  }

  function reset() {
    setPreview(null);
    setFallo(null);
    setHecho(null);
    setConfirmaReplace(false);
  }

  async function enviar(paso: "preview" | "apply") {
    if (!file) return;
    setBusy(paso);
    setFallo(null);
    setHecho(null);
    try {
      const res = await fetch(url(paso), {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      const data = await res.json();
      if (paso === "preview") {
        setPreview(data);
        if (data.error) setFallo(mensajeError(data));
      } else if (!res.ok) {
        setFallo(mensajeError(data));
      } else {
        setHecho(t("data.applied"));
        setPreview(null);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch {
      setFallo(t("data.networkError"));
    } finally {
      setBusy(null);
    }
  }

  function mensajeError(data: Preview): string {
    const clave = `data.err.${data.error}`;
    const traducido = t(clave);
    const base = traducido === clave ? data.error || t("data.genericError") : traducido;
    const extra = Array.isArray(data.detalle) ? data.detalle.join(" · ") : data.detalle;
    return extra ? `${base} — ${extra}` : base;
  }

  const totales = preview?.summary
    ? Object.values(preview.summary).reduce(
        (acc, s) => ({ added: acc.added + s.added, updated: acc.updated + s.updated, unchanged: acc.unchanged + s.unchanged }),
        { added: 0, updated: 0, unchanged: 0 }
      )
    : null;

  const bloqueado = !preview || !preview.valid || (modo === "replace" && !confirmaReplace);

  return (
    <section className="rounded-xl2 bg-panel p-4 shadow-card animate-fadein">
      <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-ink-soft">
        <Upload size={16} aria-hidden="true" />
        {t("data.importTitle")}
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        {destino === "global" ? t("data.importIntoGlobal") : t("data.importIntoSession")}
      </p>

      <div className="mt-4 space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept=".json,.csv,.sqlite,.db"
          className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-hover file:px-3 file:py-1 file:text-ink`}
          aria-label={t("data.chooseFile")}
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            reset();
          }}
        />

        {esCsv && (
          <label className="block text-sm text-ink-soft">
            {t("data.csvEntityLabel")}
            <select className={`${inputClass} mt-1`} value={entity} onChange={(e) => { setEntity(e.target.value); reset(); }}>
              {ENTITIES.map((x) => (
                <option key={x} value={x}>{t(`editor.tabs.${x}`)}</option>
              ))}
            </select>
          </label>
        )}

        <fieldset className="rounded-lg border border-hover p-3">
          <legend className="px-1 text-xs uppercase tracking-wider text-ink-soft">{t("data.modeLabel")}</legend>
          {(["merge", "replace"] as Modo[]).map((m) => (
            <label key={m} className="flex items-start gap-2 py-1 text-sm text-ink">
              <input
                type="radio"
                name="import-mode"
                className="mt-1 accent-current"
                checked={modo === m}
                onChange={() => { setModo(m); setConfirmaReplace(false); }}
              />
              <span>
                <span className="font-medium">{t(`data.mode.${m}`)}</span>
                <span className="block text-xs text-ink-soft">{t(`data.mode.${m}Hint`)}</span>
              </span>
            </label>
          ))}

          {modo === "replace" && (
            <div className="mt-2 rounded-lg border border-hover bg-base p-3">
              <p className="flex items-start gap-2 text-sm text-ink">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{destino === "global" ? t("data.replaceWarnGlobal") : t("data.replaceWarnSession")}</span>
              </p>
              <label className="mt-2 flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-current"
                  checked={confirmaReplace}
                  onChange={(e) => setConfirmaReplace(e.target.checked)}
                />
                {t("data.replaceConfirm")}
              </label>
            </div>
          )}
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={!file || busy !== null} onClick={() => enviar("preview")}>
            {busy === "preview" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
            {t("data.preview")}
          </button>
          <button type="button" className={btnGhost} disabled={bloqueado || busy !== null} onClick={() => enviar("apply")}>
            {busy === "apply" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
            {t("data.apply")}
          </button>
        </div>
      </div>

      {fallo && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-hover bg-base p-3 text-sm text-ink">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {fallo}
        </p>
      )}
      {hecho && (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-hover bg-base p-3 text-sm text-ink">
          <CheckCircle2 size={16} aria-hidden="true" />
          {hecho}
        </p>
      )}

      {preview && !preview.error && (
        <div className="mt-4 space-y-3">
          {preview.warnings?.map((w, i) => (
            <p key={i} className="flex items-start gap-2 rounded-lg border border-hover bg-base p-3 text-sm text-ink-soft">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {w.message}
            </p>
          ))}

          {preview.errors?.length > 0 && (
            <div className="rounded-lg border border-hover bg-base p-3">
              <p className="text-sm font-medium text-ink">
                {t("data.errorsFound", { n: String(preview.errors.length) })}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-ink-soft">
                {preview.errors.slice(0, 10).map((e, i) => <li key={i}>· {e.message}</li>)}
                {preview.errors.length > 10 && <li>· …</li>}
              </ul>
            </div>
          )}

          {preview.summary && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] text-sm">
                <caption className="sr-only">{t("data.previewCaption")}</caption>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-ink-soft">
                    <th scope="col" className="py-1 pr-3">{t("data.col.entity")}</th>
                    <th scope="col" className="py-1 pr-3">{t("data.col.added")}</th>
                    <th scope="col" className="py-1 pr-3">{t("data.col.updated")}</th>
                    <th scope="col" className="py-1">{t("data.col.unchanged")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(preview.summary).map(([k, s]) => (
                    <tr key={k} className="border-t border-hover text-ink">
                      <td className="py-1.5 pr-3">{t(`editor.tabs.${k}`)}</td>
                      <td className="py-1.5 pr-3">{s.added}</td>
                      <td className="py-1.5 pr-3">{s.updated}</td>
                      <td className="py-1.5 text-ink-soft">{s.unchanged}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totales && totales.added === 0 && totales.updated === 0 && (
                <p className="mt-2 text-sm text-ink-soft">{t("data.noChanges")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
