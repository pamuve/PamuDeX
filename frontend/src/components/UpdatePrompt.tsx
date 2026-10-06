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
      // Por encima de la cápsula de navegación de móvil; en `lg` ya no existe.
      // `z-20`: por debajo de las barras (z-30), para que un menú abierto desde
      // ellas no quede tapado por el aviso.
      className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-4 z-20 mx-auto
                 glass flex max-w-sm items-start gap-3 rounded-xl2 p-4 animate-fadein
                 sm:inset-x-auto sm:right-4"
    >
      <RefreshCw size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{t("update.ready")}</p>
        <button onClick={aplicarActualizacion} className="btn-primary mt-3 min-h-[2.25rem] px-3">
          {t("update.apply")}
        </button>
      </div>
      <button
        onClick={descartarActualizacion}
        aria-label={t("update.dismiss")}
        title={t("update.dismiss")}
        className="-m-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-hover hover:text-ink"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
