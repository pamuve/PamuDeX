import { useState } from "react";
import { Plus } from "lucide-react";
import { useCombobox } from "../hooks/useCombobox";
import { normalizar } from "../lib/search";
import { useI18n } from "../i18n";
import type { PokemonSummary } from "../types";

/**
 * Autocompletado para añadir un Pokémon al equipo.
 *
 * Es el segundo `combobox` de la app (8.2) y comparte el teclado con el
 * buscador global a través de `hooks/useCombobox`: flechas para recorrer,
 * `Enter` para añadir, `Escape` para cerrar y otra vez `Escape` para limpiar.
 * El foco no se mueve del campo, que es lo que distingue este patrón del menú
 * de la barra superior.
 *
 * `label` sustituye al marcador de posición como nombre accesible: el
 * marcador desaparece en cuanto se escribe, y aquí hay DOS campos idénticos en
 * la misma página (equipo propio y rival) que sin nombre no se distinguen.
 */
export function AddPokemonBox({
  allPokemon,
  disabled,
  label,
  placeholder,
  onAdd,
}: {
  allPokemon: PokemonSummary[];
  disabled: boolean;
  label: string;
  placeholder: string;
  onAdd: (dex: number, id: number) => void;
}) {
  const { t, name } = useI18n();
  const [q, setQ] = useState("");
  const nombre = name;
  const filtered = allPokemon
    // Sin tildes y en los dos idiomas, como el buscador de la portada.
    .filter((p) => {
      const texto = normalizar(q);
      return normalizar(p.name_es).includes(texto) || normalizar(p.name_en || "").includes(texto);
    })
    .slice(0, 8);

  function elegir(p: PokemonSummary) {
    onAdd(p.dex, p.id);
    setQ("");
    combo.setOpen(false);
    combo.setActivo(-1);
  }

  const combo = useCombobox({
    count: filtered.length,
    onSelect: (i) => elegir(filtered[i]),
    onEscapeClosed: () => setQ(""),
  });

  const abierta = combo.open && q.length > 0;

  if (disabled) return null;

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          combo.setOpen(true);
        }}
        onFocus={() => combo.setOpen(true)}
        onBlur={() => combo.setOpen(false)}
        placeholder={placeholder}
        aria-label={label}
        {...combo.inputProps}
        aria-expanded={abierta}
        className="w-full bg-hover rounded-xl2 px-4 py-3 text-sm text-ink outline-none"
      />
      <span className="sr-only" role="status" aria-live="polite">
        {abierta ? t("search.count", { count: filtered.length }) : ""}
      </span>
      {abierta && (
        <ul
          ref={combo.listRef}
          id={combo.listId}
          role="listbox"
          aria-label={label}
          className="popover absolute mt-1 w-full origin-top max-h-56 overflow-auto z-20"
        >
          {filtered.map((p, i) => (
            <li
              key={p.id}
              id={combo.optionId(i)}
              role="option"
              aria-selected={i === combo.activo}
              // `onMouseDown`: el `blur` del campo cierra la lista antes de que
              // llegue el `click`, así que para entonces la fila ya no existe.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(p);
              }}
              onMouseEnter={() => combo.setActivo(i)}
              className={`flex items-center justify-between px-4 py-2 text-sm text-ink cursor-pointer ${
                i === combo.activo ? "bg-hover" : ""
              }`}
            >
              <span>{nombre(p)}</span>
              <Plus size={14} className="text-ink-soft" aria-hidden="true" />
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-2 text-sm text-ink-soft">{t("empty.results")}</li>
          )}
        </ul>
      )}
    </div>
  );
}
