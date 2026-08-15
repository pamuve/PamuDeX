/**
 * PamuDeX — Tarea 8.3
 * Aviso de «hay una versión nueva lista».
 *
 * POR QUÉ EL SERVICE WORKER PASÓ DE `autoUpdate` A `prompt`
 * ........................................................
 * Con `autoUpdate` el service worker se reemplazaba solo y recargaba la página
 * sin avisar. Dos motivos para cambiarlo: no había ningún momento en el que
 * pudiera existir un aviso de actualización —el caso de uso que pide la 8.3—,
 * y una recarga sorpresa en mitad de una edición del editor de ROM Hacks es
 * justo lo que no debe pasar. Ahora la versión nueva espera a que el usuario
 * diga cuándo.
 *
 * EL AVISO EN PANTALLA ES EL PRINCIPAL; LA NOTIFICACIÓN ES EL EXTRA
 * ................................................................
 * Esta franja se ve SIEMPRE que hay una versión esperando, con o sin permiso de
 * notificaciones. La notificación del sistema solo añade el caso que la franja
 * no cubre: que la pestaña esté en segundo plano cuando llega la versión nueva.
 * Así el criterio de aceptación «con las notificaciones bloqueadas, el resto de
 * la app funciona igual» se cumple por construcción.
 */

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { notificar } from "../lib/notifications";
import {
  SW_UPDATE_EVENT,
  hayActualizacion,
  aplicarActualizacion,
  descartarActualizacion,
} from "../lib/serviceWorker";
import { useI18n } from "../i18n";

export function UpdatePrompt() {
  const { t } = useI18n();
  const [pendiente, setPendiente] = useState(() => hayActualizacion());

  // Una sola notificación por versión detectada, aunque React repinte.
  const yaAvisado = useRef(false);

  useEffect(() => {
    const sync = () => setPendiente(hayActualizacion());
    window.addEventListener(SW_UPDATE_EVENT, sync);
    return () => window.removeEventListener(SW_UPDATE_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!pendiente || yaAvisado.current) return;
    yaAvisado.current = true;

    // Solo si la pestaña NO está a la vista: si el usuario está mirando, ya
    // tiene la franja delante y una notificación encima sobraría.
    if (document.visibilityState === "visible") return;
    notificar(t("update.notificationTitle"), t("update.notificationBody"));
  }, [pendiente, t]);

  if (!pendiente) return null;

  return (
    // `role="status"` y no `alert`: es informativo y no urgente, así que no
    // debe interrumpir al lector de pantalla en mitad de otra cosa.
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md flex-wrap items-center gap-3
                 rounded-xl2 border border-hover bg-panel p-4 shadow-card animate-fadein sm:inset-x-auto sm:right-4"
    >
      <RefreshCw size={18} className="shrink-0 text-ink-soft" aria-hidden="true" />
      <p className="min-w-[10rem] flex-1 text-sm text-ink">{t("update.ready")}</p>
      <button
        onClick={aplicarActualizacion}
        className="rounded-lg bg-hover px-4 py-2 text-sm text-ink transition-colors hover:bg-base"
      >
        {t("update.apply")}
      </button>
      <button
        onClick={descartarActualizacion}
        aria-label={t("update.dismiss")}
        title={t("update.dismiss")}
        className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-hover hover:text-ink"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
