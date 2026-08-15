/**
 * PamuDeX — Tarea 8.4
 * «No he podido cargar esta ficha».
 *
 * POR QUÉ HACÍA FALTA
 * ...................
 * Probando la app en modo avión salieron dos comportamientos malos que solo se
 * ven sin red: `/tipo/:id`, `/movimiento/:id` y `/habilidad/:id` se quedaban en
 * «Cargando...» para siempre, y `/pokemon/:id` decía «esta ficha no está
 * permitida en el modo Champions» aunque no hubiera ningún modo activo, porque
 * trataba cualquier fallo como un 404.
 *
 * Ahora un fallo de red se distingue de una respuesta del servidor
 * (`lib/api.ts`, `ApiError.status === 0`) y cada uno dice lo suyo. El botón de
 * reintentar es lo que convierte esto en algo útil: al volver la cobertura no
 * hay que dar marcha atrás ni recargar a mano.
 */

import { Link } from "react-router-dom";
import { RotateCcw, WifiOff } from "lucide-react";
import { useI18n } from "../i18n";

export function LoadError({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  const { t } = useI18n();

  return (
    // `div` y no `main`: el único hito de la página lo pone App.tsx (8.2).
    <div className="max-w-2xl mx-auto px-4 py-12 text-center animate-fadein">
      <WifiOff size={40} className="mx-auto text-ink-soft mb-3" aria-hidden="true" />
      <p className="text-ink font-medium mb-1">
        {offline ? t("error.offlineTitle") : t("error.loadTitle")}
      </p>
      <p className="text-ink-soft text-sm mb-5">
        {offline ? t("error.offlineHint") : t("error.loadHint")}
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 bg-panel hover:bg-hover text-ink rounded-lg px-5 py-2.5 text-sm transition-colors"
        >
          <RotateCcw size={16} aria-hidden="true" />
          {t("error.retry")}
        </button>
        <Link
          to="/"
          className="text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-5 py-2.5 text-sm transition-colors"
        >
          {t("error.goHome")}
        </Link>
      </div>
    </div>
  );
}
