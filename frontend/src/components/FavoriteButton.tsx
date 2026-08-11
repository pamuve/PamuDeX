/**
 * PamuDeX — Tarea 5.3
 * Estrella para marcar una entidad como favorita del perfil activo.
 *
 * El cambio es optimista: la estrella se rellena al instante y se revierte sola
 * si el servidor falla (la reversión la hace `lib/favorites.ts`; aquí solo se
 * muestra el aviso). Sin perfil activo no se pinta nada: marcar favoritos sin
 * saber de quién son no significaría nada.
 */

import { useState } from "react";
import { Star } from "lucide-react";
import { useFavorite, type FavoriteType } from "../lib/favorites";
import { useI18n } from "../i18n";

interface FavoriteButtonProps {
  type: FavoriteType;
  entityRef: string | number | undefined;
  /** `lg` para las cabeceras de ficha, `sm` para listas. */
  size?: "lg" | "sm";
}

export function FavoriteButton({ type, entityRef, size = "lg" }: FavoriteButtonProps) {
  const { t } = useI18n();
  const { isFavorite, toggle, enabled } = useFavorite(type, entityRef);
  const [failed, setFailed] = useState(false);

  if (!enabled || entityRef === undefined) return null;

  const px = size === "lg" ? 22 : 18;
  const label = isFavorite ? t("favorites.remove") : t("favorites.add");

  async function handleClick() {
    setFailed(false);
    try {
      await toggle();
    } catch {
      setFailed(true);
      window.setTimeout(() => setFailed(false), 2500);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        onClick={handleClick}
        aria-pressed={isFavorite}
        aria-label={label}
        title={failed ? t("favorites.toggleError") : label}
        className={`p-2 rounded-lg transition-colors ${
          isFavorite ? "text-[#F8D030] hover:bg-hover" : "text-ink-soft hover:text-ink hover:bg-hover"
        }`}
      >
        <Star
          size={px}
          aria-hidden="true"
          fill={isFavorite ? "currentColor" : "none"}
          className={failed ? "animate-pulse" : undefined}
        />
      </button>
      {failed && (
        <span role="alert" className="sr-only">
          {t("favorites.toggleError")}
        </span>
      )}
    </span>
  );
}
