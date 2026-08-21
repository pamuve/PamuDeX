import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ItemSummary } from "../types";
import { useCombobox } from "../hooks/useCombobox";
import { useI18n } from "../i18n";

const MAX_SUGERENCIAS = 8;

/**
 * Autocompletado del objeto equipado en el comparador de equipos.
 *
 * POR QUÉ NO ES UN `<select>` COMO LA HABILIDAD
 * ---------------------------------------------
 * La habilidad sale de la ficha del Pokémon: son dos o tres y la lista está
 * cerrada. Los objetos son **2151** y además esto es una herramienta para ROM
 * Hacks, donde puede haber objetos que no están en el catálogo. Un desplegable
 * de 2151 filas es inservible en móvil y encima cerraría la puerta a lo
 * inventado, así que es un `combobox`: sugiere del catálogo pero acepta texto
 * libre.
 *
 * QUÉ SE GUARDA
 * -------------
 * Siempre el `name_es`, igual que `ability` y `nature`. Es el valor canónico del
 * proyecto y hace que el equipo guardado no dependa del idioma con el que se
 * montó: al cambiar a inglés el objeto se sigue reconociendo y se pinta
 * traducido. Lo que se escribe a mano se guarda tal cual.
 *
 * El teclado y `aria-activedescendant` los pone `hooks/useCombobox`, el mismo
 * que usan el buscador global y el de añadir Pokémon (8.2).
 */
export function ItemCombobox({
  value,
  items,
  label,
  onChange,
}: {
  value: string;
  items: ItemSummary[];
  /** Nombre accesible. En una página con hasta doce campos «Objeto» idénticos
   *  tiene que llevar el nombre del Pokémon o no se distinguen. */
  label: string;
  onChange: (nameEs: string) => void;
}) {
  const { t, lang } = useI18n();
  const nombre = useCallback(
    (o: { name_es: string; name_en: string }) => (lang === "en" ? o.name_en : o.name_es),
    [lang]
  );

  /** Del valor guardado (`name_es`) al rótulo del idioma actual. */
  const etiqueta = useCallback(
    (canonico: string) => {
      if (!canonico) return "";
      const encontrado = items.find((i) => i.name_es === canonico);
      return encontrado ? nombre(encontrado) : canonico;
    },
    [items, nombre]
  );

  const [texto, setTexto] = useState(() => etiqueta(value));

  /*
    Mientras el campo tiene el foco manda lo que escribe el usuario; cuando no lo
    tiene, manda el valor guardado. Sin esta distinción, el efecto de abajo
    reescribiría el campo en mitad de una palabra en cuanto el catálogo terminara
    de cargar o se cambiara de idioma.
  */
  const editando = useRef(false);

  useEffect(() => {
    if (editando.current) return;
    setTexto(etiqueta(value));
  }, [etiqueta, value]);

  const sugerencias = useMemo(() => {
    const q = texto.trim().toLowerCase();
    const base = q ? items.filter((i) => nombre(i).toLowerCase().includes(q)) : items;
    return base.slice(0, MAX_SUGERENCIAS);
  }, [items, nombre, texto]);

  /** Del rótulo escrito al valor canónico, si coincide con un objeto real. */
  function canonizar(escrito: string) {
    const q = escrito.trim().toLowerCase();
    if (!q) return "";
    const exacto = items.find((i) => nombre(i).toLowerCase() === q);
    return exacto ? exacto.name_es : escrito;
  }

  function elegir(item: ItemSummary) {
    setTexto(nombre(item));
    onChange(item.name_es);
    combo.setOpen(false);
    combo.setActivo(-1);
  }

  const combo = useCombobox({
    count: sugerencias.length,
    onSelect: (i) => elegir(sugerencias[i]),
    onEscapeClosed: () => {
      setTexto("");
      onChange("");
    },
  });

  const abierta = combo.open && sugerencias.length > 0;

  /*
    El aviso que faltaba: sin él no hay forma de saber si lo escrito significa
    algo para la app. Solo se enseña con el campo en reposo —mientras se escribe,
    todo texto a medias es «desconocido» y el cartel parpadearía en cada tecla.
  */
  const desconocido =
    Boolean(value) && !combo.open && !items.some((i) => i.name_es === value);

  return (
    <div className="relative">
      <input
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          onChange(canonizar(e.target.value));
          combo.setOpen(true);
        }}
        onFocus={() => {
          editando.current = true;
          combo.setOpen(true);
        }}
        onBlur={() => {
          editando.current = false;
          combo.setOpen(false);
          setTexto(etiqueta(value));
        }}
        placeholder={t("team.item_placeholder")}
        aria-label={label}
        {...combo.inputProps}
        aria-expanded={abierta}
        className="w-full bg-hover rounded-lg px-2 py-1.5 text-sm text-ink outline-none"
      />
      <span className="sr-only" role="status" aria-live="polite">
        {abierta ? t("search.count", { count: sugerencias.length }) : ""}
      </span>
      {desconocido && (
        <span className="block text-[11px] text-ink-soft mt-0.5">{t("team.item_custom")}</span>
      )}
      {abierta && (
        <ul
          ref={combo.listRef}
          id={combo.listId}
          role="listbox"
          aria-label={label}
          className="absolute mt-1 w-full bg-panel border border-hover rounded-xl2 shadow-card max-h-48 overflow-auto z-20 animate-fadein"
        >
          {sugerencias.map((item, i) => (
            <li
              key={item.id}
              id={combo.optionId(i)}
              role="option"
              aria-selected={i === combo.activo}
              // `onMouseDown`: el `blur` cierra la lista antes de que llegue el
              // `click`, así que para entonces la fila ya no existe.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(item);
              }}
              onMouseEnter={() => combo.setActivo(i)}
              className={`px-3 py-1.5 text-sm text-ink cursor-pointer ${
                i === combo.activo ? "bg-hover" : ""
              }`}
            >
              {nombre(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
