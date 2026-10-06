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
    <div className="card p-8 text-center animate-fadein">
      <Layers size={28} className="mx-auto mb-3 text-ink-soft" aria-hidden="true" />
      <p className="text-ink">{t("editor.noSession")}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{t("editor.noSessionHint")}</p>
      <Link
        to="/sesiones"
        className="btn-primary mt-5"
      >
        {t("editor.goToSessions")}
      </Link>
    </div>
  );
}
