/**
 * PamuDeX — Fase 9
 * Ficha de un objeto. Mismo esqueleto que la de una habilidad: carga con
 * `useDetail`, errores por `DetailError` y visita al historial.
 */
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useDetail } from "../hooks/useDetail";
import { useRecordVisit } from "../lib/history";
import { DetailError, Loading } from "../components/PageState";
import { FavoriteButton } from "../components/FavoriteButton";
import { BackLink } from "../components/BackLink";
import { categoryLabel } from "./Items";
import { useI18n } from "../i18n";
import type { ItemDetail as ItemDetailT } from "../types";

export default function ItemDetail() {
  const { id } = useParams();
  const { t, name, effect } = useI18n();
  const { data: item, fallo, reintentar } = useDetail<ItemDetailT>(() => api.items.detail(id!), [id]);

  useRecordVisit("item", item ? item.id : undefined);

  if (fallo) return <DetailError fallo={fallo} onRetry={reintentar} />;
  if (!item) return <Loading />;

  const texto = effect(item);
  // El otro nombre del objeto: útil para buscarlo en guías en el otro idioma.
  const otroNombre = name(item) === item.name_es ? item.name_en : item.name_es;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-2 pb-6 sm:pt-4 sm:pb-8 space-y-4 sm:space-y-6">
      <BackLink />
      <section className="card animate-fadein">
        <div className="mb-1 flex items-center gap-1">
          <h1 className="min-w-0 break-words font-display text-2xl font-bold text-ink">{name(item)}</h1>
          <FavoriteButton type="item" entityRef={item.id} />
        </div>
        <p className="text-sm text-ink-soft">
          {categoryLabel(item.category, t("items.noCategory"))}
          {otroNombre && otroNombre !== name(item) ? ` · ${otroNombre}` : ""}
        </p>
        <p className="mt-3 max-w-prose text-sm text-ink">{texto || t("items.noEffect")}</p>
      </section>
    </div>
  );
}
