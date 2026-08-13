/**
 * PamuDeX — Tarea 6.3
 * «Esta ficha no existe en el modo Champions».
 *
 * Las páginas de ficha son las mismas dentro y fuera del modo (ese era el
 * criterio de la tarea), así que se puede llegar a una ficha prohibida por un
 * enlace antiguo, por el historial, por los favoritos o escribiendo la URL. El
 * backend responde 404 y sin esto la página se quedaba cargando para siempre.
 */

import { Link } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { useI18n } from "../i18n";

export function NotAllowed() {
  const { t } = useI18n();

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-center animate-fadein">
      <ShieldOff size={40} className="mx-auto text-ink-soft mb-3" aria-hidden="true" />
      <p className="text-ink font-medium mb-1">{t("championsHome.notAllowed")}</p>
      <p className="text-ink-soft text-sm mb-5">{t("championsHome.notAllowedHint")}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        <Link
          to="/champions"
          className="bg-panel hover:bg-hover text-ink rounded-lg px-5 py-2.5 text-sm transition-colors"
        >
          {t("championsHome.title")}
        </Link>
        <Link
          to="/champions/reglas"
          className="text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-5 py-2.5 text-sm transition-colors"
        >
          {t("champions.title")}
        </Link>
      </div>
    </main>
  );
}
