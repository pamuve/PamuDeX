/**
 * PamuDeX — Tareas 3.3 / 3.4 / 3.5
 * Aviso que sustituye al editor cuando no hay ninguna sesión activa.
 * Los datos globales no se editan nunca: siempre se trabaja sobre una sesión.
 */

import { Link } from "react-router-dom";
import { Layers } from "lucide-react";

interface Props {
  t: (key: string, params?: Record<string, string>) => string;
}

export default function SessionRequired({ t }: Props) {
  return (
    <div className="rounded-xl2 bg-panel p-8 text-center shadow-card animate-fadein">
      <Layers size={28} className="mx-auto mb-3 text-ink-soft" aria-hidden="true" />
      <p className="text-ink">{t("editor.noSession")}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{t("editor.noSessionHint")}</p>
      <Link
        to="/sesiones"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-hover px-4 py-2 text-sm font-medium text-ink hover:brightness-125 focus:outline-none focus:ring-2 focus:ring-ink-soft/40"
      >
        {t("editor.goToSessions")}
      </Link>
    </div>
  );
}
