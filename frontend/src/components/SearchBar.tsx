/**
 * PamuDeX — buscador con autocompletado.
 *
 * PATRÓN `combobox` DE WAI-ARIA (Tarea 8.2)
 * -----------------------------------------
 * Antes esto era un `<input>` suelto y una lista de `<button>` debajo: con el
 * teclado no había forma de llegar a los resultados sin tabular por todos
 * ellos, y el lector de pantalla no anunciaba ni que hubiera sugerencias.
 *
 * Ahora el foco **no se mueve nunca del campo de texto** —hace falta para poder
 * seguir escribiendo— y la opción activa se señala con `aria-activedescendant`,
 * que apunta al `id` de la fila resaltada. Es justo lo contrario de lo que hace
 * `hooks/useMenu.ts`, donde el foco sí viaja entre las opciones: allí no hay
 * nada que escribir.
 *
 * Teclas: flechas arriba/abajo recorren en ciclo, `Home`/`End` van a los
 * extremos, `Enter` abre la opción activa y `Escape` cierra la lista dejando el
 * foco en el campo (y, si ya estaba cerrada, borra lo escrito).
 *
 * El número de resultados se anuncia por una región `aria-live` educada: sin
 * ella, quien no ve la pantalla no se entera de que la lista ha cambiado.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "../lib/api";
import { SearchResults } from "../types";
import { useCombobox } from "../hooks/useCombobox";
import { PokemonSprite } from "./PokemonSprite";
import { useI18n } from "../i18n";

/** Una fila de la lista, ya aplanada: el teclado la recorre entera de un tirón. */
interface Opcion {
  key: string;
  path: string;
  label: string;
  color?: string;
  dex?: number;
}

export function SearchBar() {
  const { t, name } = useI18n();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  // La búsqueda va siempre a la red (no está en la caché local): sin
  // cobertura fallaba en silencio y parecía que no había resultados.
  const [errorBusqueda, setErrorBusqueda] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  /**
   * Las cuatro listas de la API en una sola, en el mismo orden en que se
   * pintan. El teclado necesita un índice plano: con cuatro arrays sueltos
   * habría que traducir posiciones en cada pulsación.
   */
  const opciones = useMemo<Opcion[]>(() => {
    if (!results) return [];
    const nombre = name;
    return [
      ...results.pokemon.map((p) => ({
        key: `p-${p.id}`,
        path: `/pokemon/${p.id}`,
        label: nombre(p),
        dex: p.dex,
      })),
      ...results.types.map((tp) => ({
        key: `t-${tp.id}`,
        path: `/tipo/${tp.id}`,
        label: nombre(tp),
        color: tp.color,
      })),
      ...results.moves.map((m) => ({
        key: `m-${m.id}`,
        path: `/movimiento/${m.id}`,
        label: nombre(m),
        color: m.color,
      })),
      ...results.abilities.map((a) => ({
        key: `a-${a.id}`,
        path: `/habilidad/${a.id}`,
        label: nombre(a),
      })),
    ];
  }, [results, name]);

  function go(path: string) {
    navigate(path);
    combo.setOpen(false);
    combo.setActivo(-1);
    setQ("");
  }

  const combo = useCombobox({
    count: opciones.length,
    onSelect: (i) => go(opciones[i].path),
    // Segunda pulsación de Escape con la lista ya cerrada: limpiar el campo.
    // Es lo que hace cualquier buscador y ahorra borrar a mano.
    onEscapeClosed: () => setQ(""),
  });

  const abierta = combo.open && (results !== null || errorBusqueda);
  const hasResults = opciones.length > 0;

  useEffect(() => {
    setErrorBusqueda(false);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    let cancelado = false;
    const handle = setTimeout(() => {
      api
        .search(q)
        .then((r) => {
          if (cancelado) return;
          setResults(r);
          combo.setOpen(true);
        })
        .catch(() => {
          if (cancelado) return;
          setResults(null);
          setErrorBusqueda(true);
          combo.setOpen(true);
        });
    }, 150);
    return () => {
      cancelado = true;
      clearTimeout(handle);
    };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) combo.setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={boxRef} className="relative w-full max-w-xl mx-auto">
      <div className="card flex items-center gap-2 px-4 py-3 border border-hover focus-within:border-accent transition-colors">
        <Search size={18} className="text-ink-soft" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results && combo.setOpen(true)}
          placeholder={t("search.placeholder")}
          // El marcador de posición NO sirve de nombre accesible: desaparece al
          // escribir y no todos los lectores lo anuncian.
          aria-label={t("search.label")}
          {...combo.inputProps}
          className="bg-transparent outline-none w-full text-ink placeholder:text-ink-soft/70"
        />
      </div>

      {/* Cuántos resultados hay. `polite` para no cortar al lector mientras se
          escribe, y fuera del flujo visual porque en pantalla ya se ve. */}
      <span className="sr-only" role="status" aria-live="polite">
        {abierta ? (errorBusqueda ? t("search.error") : t("search.count", { count: opciones.length })) : ""}
      </span>

      {abierta && (
        <ul
          ref={combo.listRef}
          id={combo.listId}
          role="listbox"
          aria-label={t("search.label")}
          className="popover absolute mt-2 w-full origin-top max-h-96 overflow-auto z-20"
        >
          {!hasResults && (
            <li className={`px-4 py-4 text-sm ${errorBusqueda ? "text-danger" : "text-ink-soft"}`}>
              {errorBusqueda ? t("search.error") : t("empty.results")}
            </li>
          )}

          {opciones.map((o, i) => (
            <li
              key={o.key}
              id={combo.optionId(i)}
              role="option"
              aria-selected={i === combo.activo}
              // `onMouseDown` y no `onClick`: el clic llega después del
              // `mousedown` que cierra la lista, y para entonces ya no existe.
              onMouseDown={(e) => {
                e.preventDefault();
                go(o.path);
              }}
              onMouseEnter={() => combo.setActivo(i)}
              className={`px-4 py-2.5 flex items-center justify-between gap-2 cursor-pointer ${
                i === combo.activo ? "bg-hover" : ""
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                {/* Solo los Pokémon traen `dex`, así que el sprite distingue de
                    un vistazo sus filas de las de tipos, movimientos y
                    habilidades, que siguen con su punto de color. */}
                {o.dex !== undefined && (
                  <PokemonSprite dex={o.dex} nombre={o.label} className="w-7 h-7 shrink-0" />
                )}
                {o.color && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: o.color }}
                    aria-hidden="true"
                  />
                )}
                <span className="text-ink truncate">{o.label}</span>
              </span>
              {o.dex !== undefined && (
                <span className="text-ink-soft text-xs font-mono shrink-0">
                  #{String(o.dex).padStart(3, "0")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
