/**
 * PamuDeX — los estados de una página que no es la página: cargando, sin red,
 * error del servidor, no existe y no permitida en Champions.
 *
 * Antes vivían repartidos (`LoadError.tsx`, `NotAllowed.tsx` y un «Cargando...»
 * suelto en cada ficha) y cada ficha decidía por su cuenta cuál pintar. Ahí
 * estaba el fallo: cualquier error que no fuese de red acababa en «no
 * permitida en Champions», también fuera del modo y también ante un 404 de
 * verdad (`/pokemon/99999`). `DetailError` decide en un único sitio.
 *
 * Todos son `div` y no `main`: el único hito de la página lo pone App.tsx (8.2).
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, RotateCcw, SearchX, ServerCrash, ShieldOff, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useActiveChampions } from "../lib/champions";
import type { Fallo } from "../hooks/useDetail";
import { useI18n } from "../i18n";

/**
 * Indicador de carga. Aparece con 150 ms de retraso: con la caché local la
 * mayoría de cargas tardan menos que eso, y un indicador que parpadea un
 * instante se percibe como más lento que no ver ninguno.
 */
export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 py-16 text-sm text-ink-soft
                 animate-[fadein_180ms_ease-out_150ms_both]"
    >
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      {label ?? t("common.loading")}
    </p>
  );
}

/** El esqueleto común: icono, título, explicación y acciones. */
function Estado({
  Icon,
  title,
  hint,
  children,
  Heading = "h1",
}: {
  Icon: LucideIcon;
  title: string;
  hint: string;
  children: ReactNode;
  /** `h2` cuando el estado ocupa solo una sección de una página que ya tiene
   *  su `h1` (8.2: un único `h1` por página). */
  Heading?: "h1" | "h2";
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center animate-fadein">
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-panel text-ink-soft">
        <Icon size={26} aria-hidden="true" />
      </span>
      <Heading className="mb-1.5 font-display text-lg font-semibold text-ink">{title}</Heading>
      <p className="mb-6 text-sm text-ink-soft">{hint}</p>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  );
}

/** Sin red, o el servidor respondió con un error que no es un 404. */
export function LoadError({
  offline,
  onRetry,
  heading,
}: {
  offline: boolean;
  onRetry: () => void;
  heading?: "h1" | "h2";
}) {
  const { t } = useI18n();
  return (
    <Estado
      Heading={heading}
      Icon={offline ? WifiOff : ServerCrash}
      title={offline ? t("error.offlineTitle") : t("error.loadTitle")}
      hint={offline ? t("error.offlineHint") : t("error.loadHint")}
    >
      <button type="button" onClick={onRetry} className="btn-primary">
        <RotateCcw size={16} aria-hidden="true" />
        {t("error.retry")}
      </button>
      <Link to="/" className="btn-ghost">
        {t("error.goHome")}
      </Link>
    </Estado>
  );
}

/** Ruta que no existe, o ficha con un id que no está en el dataset. */
export function NotFound() {
  const { t } = useI18n();
  return (
    <Estado Icon={SearchX} title={t("notFound.title")} hint={t("notFound.hint")}>
      <Link to="/" className="btn-primary">
        {t("error.goHome")}
      </Link>
    </Estado>
  );
}

/**
 * Ficha que el conjunto de reglas de Champions no permite (6.3). Se llega por
 * un enlace antiguo, el historial, los favoritos o escribiendo la URL.
 */
export function NotAllowed() {
  const { t } = useI18n();
  return (
    <Estado
      Icon={ShieldOff}
      title={t("championsHome.notAllowed")}
      hint={t("championsHome.notAllowedHint")}
    >
      <Link to="/champions" className="btn-primary">
        {t("championsHome.title")}
      </Link>
      <Link to="/champions/reglas" className="btn-ghost">
        {t("champions.title")}
      </Link>
    </Estado>
  );
}

/**
 * Qué decir cuando una ficha no ha cargado. Un 404 solo significa «no
 * permitida» si el modo Champions está activo; fuera de él, la ficha
 * sencillamente no existe.
 */
export function DetailError({ fallo, onRetry }: { fallo: Fallo; onRetry: () => void }) {
  const { champions } = useActiveChampions();
  if (fallo === "noEncontrado") return champions ? <NotAllowed /> : <NotFound />;
  return <LoadError offline={fallo === "red"} onRetry={onRetry} />;
}
