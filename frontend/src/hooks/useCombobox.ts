/**
 * PamuDeX — Tarea 8.2
 * Teclado y estado de un autocompletado (patrón `combobox` de WAI-ARIA).
 *
 * POR QUÉ ESTÁ SEPARADO DE `useMenu`
 * ----------------------------------
 * Son dos patrones distintos y la diferencia no es cosmética: en un menú el
 * foco **viaja** a la opción, y en un combobox el foco **se queda en el campo
 * de texto** —hay que poder seguir escribiendo— y la opción activa se señala
 * con `aria-activedescendant`. Mezclarlos daría un componente que no cumple
 * ninguno de los dos.
 *
 * POR QUÉ ES UN HOOK Y NO ESTÁ ESCRITO DOS VECES
 * ----------------------------------------------
 * La app tiene dos autocompletados con la misma mecánica y datos distintos: el
 * buscador global (`SearchBar`, resultados de la API) y el de añadir Pokémon al
 * equipo (`AddPokemonBox`, filtrado en local). Lo que comparten es exactamente
 * esto: qué fila está activa, qué teclas la mueven y qué `id` anunciar.
 *
 * El hook NO decide cómo se pintan las filas ni de dónde salen: recibe cuántas
 * hay y qué hacer al elegir una.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

export interface ComboboxOptions {
  /** Cuántas filas hay ahora mismo. */
  count: number;
  /** Se llama con el índice elegido (Enter o clic). */
  onSelect: (index: number) => void;
  /**
   * Qué hace `Escape` cuando la lista ya está cerrada. Sirve para el gesto
   * habitual de «segunda pulsación, borrar lo escrito».
   */
  onEscapeClosed?: () => void;
}

export interface ComboboxControl {
  open: boolean;
  setOpen: (v: boolean) => void;
  /** Índice activo, o -1 si no hay ninguno. */
  activo: number;
  setActivo: (i: number) => void;
  /** `id` de la lista, para `aria-controls` y el `id` del `<ul>`. */
  listId: string;
  /** `id` de una fila, para `aria-activedescendant` y el `id` del `<li>`. */
  optionId: (index: number) => string;
  /** Props ya listas para el `<input>`: rol, estado y teclado. */
  inputProps: {
    role: "combobox";
    "aria-expanded": boolean;
    "aria-controls": string;
    "aria-autocomplete": "list";
    "aria-activedescendant": string | undefined;
    autoComplete: "off";
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  };
  /** Referencia para el contenedor de la lista (se usa para el autoscroll). */
  listRef: React.RefObject<HTMLUListElement>;
}

export function useCombobox({ count, onSelect, onEscapeClosed }: ComboboxOptions): ComboboxControl {
  const [open, setOpen] = useState(false);
  const [activo, setActivo] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  // `useId` y no un contador global: si algún día hay dos autocompletados en la
  // misma página (hoy los hay, en /equipo) los `id` no pueden repetirse.
  const base = useId();
  const listId = `${base}-lista`;
  const optionId = useCallback((i: number) => `${base}-opcion-${i}`, [base]);

  // Al cambiar el número de filas, la que estaba activa ya no significa lo
  // mismo. Se vuelve a empezar en vez de dejar el resaltado en cualquier sitio.
  useEffect(() => {
    setActivo(-1);
  }, [count]);

  const abierta = open && count >= 0;

  // Mantener a la vista la fila activa: las listas tienen altura máxima y con
  // muchos resultados la de abajo queda fuera del recorte.
  useEffect(() => {
    if (activo < 0 || !listRef.current) return;
    listRef.current
      .querySelector<HTMLElement>(`#${CSS.escape(optionId(activo))}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activo, optionId]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (open) {
          setOpen(false);
          setActivo(-1);
        } else {
          onEscapeClosed?.();
        }
        return;
      }
      if (e.key === "ArrowDown" && !open) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (!open || count === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActivo((i) => (i + 1) % count);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActivo((i) => (i <= 0 ? count - 1 : i - 1));
          break;
        case "Home":
          e.preventDefault();
          setActivo(0);
          break;
        case "End":
          e.preventDefault();
          setActivo(count - 1);
          break;
        case "Enter":
          if (activo >= 0) {
            e.preventDefault();
            onSelect(activo);
          }
          break;
        case "Tab":
          // Tabular acepta lo escrito y cierra, no elige: elegir sin querer al
          // salir del campo es de los errores más molestos de un autocompletado.
          setOpen(false);
          setActivo(-1);
          break;
      }
    },
    [activo, count, onEscapeClosed, onSelect, open]
  );

  return {
    open,
    setOpen,
    activo,
    setActivo,
    listId,
    optionId,
    listRef,
    inputProps: {
      role: "combobox",
      "aria-expanded": abierta && open,
      "aria-controls": listId,
      "aria-autocomplete": "list",
      "aria-activedescendant": activo >= 0 ? optionId(activo) : undefined,
      autoComplete: "off",
      onKeyDown,
    },
  };
}
