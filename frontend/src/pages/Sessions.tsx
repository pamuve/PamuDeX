/**
 * PamuDeX — Tarea 3.1
 * Página /sesiones: ciclo de vida de las sesiones personalizadas.
 * El contenido de cada sesión (overrides) llega en la tarea 3.2.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Copy,
  Pencil,
  Trash2,
  Check,
  X,
  Database,
  Layers,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import { sessionsApi, type Session } from "../lib/apiSession";
import { useActiveSession } from "../lib/session";
import { useI18n } from "../i18n";

type CardMode = "view" | "edit" | "confirm-delete";

export default function Sessions() {
  const { t } = useI18n();
  const [activeId, setActiveId] = useActiveSession();

  const [list, setList] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [modes, setModes] = useState<Record<number, CardMode>>({});
  const [drafts, setDrafts] = useState<Record<number, { name: string; description: string }>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setList(await sessionsApi.list());
    } catch {
      setError(t("sessions.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setMode(id: number, mode: CardMode) {
    setModes((prev) => ({ ...prev, [id]: mode }));
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setBusyId("new");
    setError(null);
    try {
      const created = await sessionsApi.create(name, newDescription.trim());
      setList((prev) => [created, ...prev]);
      setNewName("");
      setNewDescription("");
      setCreating(false);
    } catch {
      setError(t("sessions.saveError"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(id: number) {
    const draft = drafts[id];
    const name = (draft?.name ?? "").trim();
    if (!name) return;
    setBusyId(id);
    setError(null);
    try {
      const updated = await sessionsApi.update(id, {
        name,
        description: (draft?.description ?? "").trim(),
      });
      setList((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setMode(id, "view");
    } catch {
      setError(t("sessions.saveError"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDuplicate(id: number) {
    setBusyId(id);
    setError(null);
    try {
      const copy = await sessionsApi.duplicate(id);
      setList((prev) => [copy, ...prev]);
    } catch {
      setError(t("sessions.saveError"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await sessionsApi.remove(id);
      setList((prev) => prev.filter((s) => s.id !== id));
      if (activeId === id) setActiveId(null);
    } catch {
      setError(t("sessions.deleteError"));
    } finally {
      setBusyId(null);
    }
  }

  const inputClass =
    "w-full rounded-lg bg-base px-3 py-2 text-ink placeholder:text-ink-soft/60 " +
    "border border-hover outline-none focus:border-ink-soft focus:ring-2 focus:ring-ink-soft/30";

  const btnGhost =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink-soft " +
    "hover:bg-hover hover:text-ink focus:outline-none focus:ring-2 focus:ring-ink-soft/40 " +
    "disabled:opacity-40 transition-colors";

  const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-lg bg-hover px-4 py-2 text-sm " +
    "font-medium text-ink hover:brightness-125 focus:outline-none focus:ring-2 " +
    "focus:ring-ink-soft/40 disabled:opacity-40 transition";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 animate-fadein">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-ink sm:text-2xl">
            <Layers size={22} aria-hidden="true" />
            {t("sessions.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{t("sessions.subtitle")}</p>
        </div>

        <button
          type="button"
          className={btnPrimary}
          onClick={() => setCreating((v) => !v)}
          aria-expanded={creating}
        >
          <Plus size={18} aria-hidden="true" />
          {t("sessions.new")}
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl2 border border-hover bg-panel px-4 py-3 text-sm text-ink"
        >
          {error}
        </p>
      )}

      {creating && (
        <div className="mb-5 rounded-xl2 bg-panel p-4 shadow-card animate-fadein">
          <label className="mb-1 block text-xs uppercase tracking-wide text-ink-soft" htmlFor="new-session-name">
            {t("sessions.nameLabel")}
          </label>
          <input
            id="new-session-name"
            className={inputClass}
            value={newName}
            maxLength={60}
            autoFocus
            placeholder={t("sessions.namePlaceholder")}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />

          <label
            className="mb-1 mt-3 block text-xs uppercase tracking-wide text-ink-soft"
            htmlFor="new-session-description"
          >
            {t("sessions.descriptionLabel")}
          </label>
          <input
            id="new-session-description"
            className={inputClass}
            value={newDescription}
            maxLength={300}
            placeholder={t("sessions.descriptionPlaceholder")}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setCreating(false)}>
              {t("sessions.cancel")}
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={!newName.trim() || busyId === "new"}
              onClick={handleCreate}
            >
              {busyId === "new" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {t("sessions.create")}
            </button>
          </div>
        </div>
      )}

      {/* Dataset global: equivale a "sin sesión activa" */}
      <button
        type="button"
        onClick={() => setActiveId(null)}
        aria-pressed={activeId === null}
        className={
          "mb-4 flex w-full items-start gap-3 rounded-xl2 bg-panel p-4 text-left shadow-card " +
          "transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-ink-soft/40 " +
          (activeId === null ? "ring-2 ring-ink-soft/60" : "")
        }
      >
        <Database size={20} className="mt-0.5 shrink-0 text-ink-soft" aria-hidden="true" />
        {/* `break-words`: con el distintivo «Activa» a la derecha quedan ~110px
            para el texto, y al 130% de escalado (8.1) una palabra larga
            («modificaciones.») no cabe entera en esa columna. */}
        <span className="min-w-0 flex-1 break-words">
          <span className="block font-medium text-ink">{t("sessions.global")}</span>
          <span className="block text-sm text-ink-soft">{t("sessions.globalHint")}</span>
        </span>
        {activeId === null && (
          <span className="shrink-0 rounded-full bg-hover px-2.5 py-1 text-xs text-ink">
            {t("sessions.active")}
          </span>
        )}
      </button>

      {loading && (
        <p className="flex items-center gap-2 py-8 text-sm text-ink-soft">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          {t("sessions.loading")}
        </p>
      )}

      {!loading && list.length === 0 && (
        <div className="rounded-xl2 bg-panel p-8 text-center shadow-card">
          <p className="text-ink">{t("sessions.empty")}</p>
          <p className="mt-1 text-sm text-ink-soft">{t("sessions.emptyHint")}</p>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {list.map((session) => {
          const mode = modes[session.id] ?? "view";
          const isActive = activeId === session.id;
          const busy = busyId === session.id;

          return (
            <li
              key={session.id}
              className={
                "rounded-xl2 bg-panel p-4 shadow-card animate-fadein transition " +
                (isActive ? "ring-2 ring-ink-soft/60" : "")
              }
            >
              {mode === "edit" ? (
                <>
                  <input
                    className={inputClass}
                    maxLength={60}
                    autoFocus
                    aria-label={t("sessions.nameLabel")}
                    value={drafts[session.id]?.name ?? session.name}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [session.id]: {
                          name: e.target.value,
                          description: prev[session.id]?.description ?? session.description ?? "",
                        },
                      }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleRename(session.id)}
                  />
                  <input
                    className={`${inputClass} mt-2`}
                    maxLength={300}
                    aria-label={t("sessions.descriptionLabel")}
                    value={drafts[session.id]?.description ?? session.description ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [session.id]: {
                          name: prev[session.id]?.name ?? session.name,
                          description: e.target.value,
                        },
                      }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleRename(session.id)}
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" className={btnGhost} onClick={() => setMode(session.id, "view")}>
                      <X size={16} aria-hidden="true" />
                      {t("sessions.cancel")}
                    </button>
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={busy}
                      onClick={() => handleRename(session.id)}
                    >
                      <Check size={16} aria-hidden="true" />
                      {t("sessions.save")}
                    </button>
                  </div>
                </>
              ) : mode === "confirm-delete" ? (
                <>
                  <p className="text-ink">{t("sessions.confirmDelete", { name: session.name })}</p>
                  <p className="mt-1 text-sm text-ink-soft">{t("sessions.confirmDeleteHint")}</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" className={btnGhost} onClick={() => setMode(session.id, "view")}>
                      {t("sessions.cancel")}
                    </button>
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={busy}
                      onClick={() => handleDelete(session.id)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      {t("sessions.delete")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 break-words font-medium text-ink">{session.name}</h2>
                    {isActive && (
                      <span className="shrink-0 rounded-full bg-hover px-2.5 py-1 text-xs text-ink">
                        {t("sessions.active")}
                      </span>
                    )}
                  </div>

                  {session.description && (
                    <p className="mt-1 text-sm text-ink-soft">{session.description}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-1">
                    {isActive ? (
                      <Link to="/editor" className={btnGhost}>
                        <SlidersHorizontal size={16} aria-hidden="true" />
                        {t("sessions.edit")}
                      </Link>
                    ) : (
                      <button type="button" className={btnGhost} onClick={() => setActiveId(session.id)}>
                        {t("sessions.use")}
                      </button>
                    )}
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={busy}
                      onClick={() => {
                        setDrafts((prev) => ({
                          ...prev,
                          [session.id]: {
                            name: session.name,
                            description: session.description ?? "",
                          },
                        }));
                        setMode(session.id, "edit");
                      }}
                    >
                      <Pencil size={16} aria-hidden="true" />
                      {t("sessions.rename")}
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={busy}
                      onClick={() => handleDuplicate(session.id)}
                    >
                      <Copy size={16} aria-hidden="true" />
                      {t("sessions.duplicate")}
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={busy}
                      onClick={() => setMode(session.id, "confirm-delete")}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      {t("sessions.delete")}
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
