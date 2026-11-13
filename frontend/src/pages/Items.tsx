/**
 * PamuDeX — Fase 9
 * El catálogo de objetos, en su propia sección.
 *
 * NO VA EN EL BUSCADOR DE LA POKÉDEX A PROPÓSITO: son 2151 entradas, más que
 * Pokémon, movimientos y habilidades juntos, y muchas se llaman como un
 * movimiento («Lanzallamas» y la «MT Lanzallamas»). Mezclarlas ahí enterraría
 * lo que se busca casi siempre. Aquí tienen su buscador y su filtro de
 * categoría.
 *
 * El listado completo ya está en la caché local (`RUTAS_CATALOGO`), así que se
 * filtra en el cliente: responde al instante y funciona sin conexión.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "../lib/api";
import { normalizar } from "../lib/search";
import { clasificarFallo, type Fallo } from "../hooks/useDetail";
import { LoadError, Loading } from "../components/PageState";
import { useI18n } from "../i18n";
import type { ItemSummary } from "../types";

/** `held-items` -> «Held items». El dataset trae la categoría como identificador. */
export function categoryLabel(category: string | null, sinCategoria: string): string {
  if (!category) return sinCategoria;
  const texto = category.replace(/-/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const TOPE = 300;

export default function Items() {
  const { t, name } = useI18n();
  const [items, setItems] = useState<ItemSummary[] | null>(null);
  const [fallo, setFallo] = useState<Fallo | null>(null);
  const [reintento, setReintento] = useState(0);
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("");

  useEffect(() => {
    setFallo(null);
    let cancelado = false;
    api.items
      .list()
      .then((lista) => !cancelado && setItems(lista))
      .catch((err) => !cancelado && setFallo(clasificarFallo(err)));
    return () => {
      cancelado = true;
    };
  }, [reintento]);

  const categorias = useMemo(
    () => [...new Set((items || []).map((i) => i.category).filter((c): c is string => Boolean(c)))].sort(),
    [items]
  );

  const visibles = useMemo(() => {
    if (!items) return [];
    const texto = normalizar(q.trim());
    return items.filter(
      (i) =>
        (!categoria || i.category === categoria) &&
        (!texto || normalizar(i.name_es).includes(texto) || normalizar(i.name_en || "").includes(texto))
    );
  }, [items, q, categoria]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-4">
      <h1 className="page-title">{t("items.title")}</h1>

      <div className="flex flex-wrap gap-2.5">
        <label className="card flex min-w-[min(16rem,100%)] flex-1 items-center gap-2 border border-hover px-4 py-3 focus-within:border-accent">
          <Search size={18} className="text-ink-soft" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("items.search")}
            aria-label={t("items.search")}
            className="w-full bg-transparent text-ink outline-none placeholder:text-ink-soft/70"
          />
        </label>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          aria-label={t("items.category")}
          className="min-h-[2.75rem] max-w-full rounded-xl2 bg-panel px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="">{t("items.allCategories")}</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c, "")}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-ink-soft tabular-nums" role="status" aria-live="polite">
        {items ? t("items.count", { count: visibles.length }) : ""}
      </p>

      {fallo ? (
        <LoadError heading="h2" offline={fallo === "red"} onRetry={() => setReintento((n) => n + 1)} />
      ) : !items ? (
        <Loading />
      ) : visibles.length === 0 ? (
        <p className="notice text-sm">{t("empty.results")}</p>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {visibles.slice(0, TOPE).map((it) => (
              <li key={it.id}>
                <Link to={`/objeto/${it.id}`} className="card-link flex min-h-[3.25rem] flex-col justify-center px-4 py-2.5">
                  <span className="break-words font-medium text-ink">{name(it)}</span>
                  <span className="text-xs text-ink-soft">{categoryLabel(it.category, t("items.noCategory"))}</span>
                </Link>
              </li>
            ))}
          </ul>
          {visibles.length > TOPE && <p className="text-sm text-ink-soft">{t("items.refine", { count: TOPE })}</p>}
        </>
      )}
    </div>
  );
}
