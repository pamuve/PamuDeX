/**
 * «‹ Atrás» de las fichas.
 *
 * Instalada como PWA (`display: standalone`) la app no tiene la barra del
 * navegador, así que sin esto una ficha abierta desde el buscador era un
 * callejón sin salida: la única forma de volver era la barra inferior, que
 * lleva a la portada y no a donde estabas.
 *
 * Vuelve en el historial si la ficha se abrió desde dentro de la app; si se
 * entró directamente (un enlace compartido, un favorito del sistema), no hay
 * nada a lo que volver dentro de PamuDeX y lleva a la portada.
 */

import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "../i18n";

export function BackLink() {
  const { t } = useI18n();
  const navigate = useNavigate();
  // react-router guarda en `history.state.idx` la posición dentro de la app.
  const hayAtras = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

  return (
    <button
      type="button"
      onClick={() => (hayAtras ? navigate(-1) : navigate("/"))}
      className="pressable -ml-2 inline-flex min-h-[2.75rem] items-center gap-0.5 rounded-lg pl-1 pr-3
                 text-sm font-medium text-accent hover:bg-hover"
    >
      <ChevronLeft size={20} aria-hidden="true" />
      {hayAtras ? t("nav.back") : t("nav.pokedex")}
    </button>
  );
}
