/**
 * PamuDeX — Tarea 8.2
 * Comportamiento de teclado y foco de un menú desplegable.
 *
 * POR QUÉ UN HOOK Y NO ARREGLARLO TRES VECES
 * ------------------------------------------
 * La barra superior tiene tres desplegables (idioma, modo y perfil) con el
 * mismo `useState(open)` copiado, y a los tres les faltaba exactamente lo
 * mismo: cerrar con `Escape`, cerrar al pulsar fuera, moverse con las flechas y
 * devolver el foco al botón que lo abrió. Arreglarlo tres veces garantiza que
 * el cuarto menú que alguien añada vuelva a nacer roto.
 *
 * QUÉ IMPLEMENTA (patrón `menu button` de WAI-ARIA)
 * ------------------------------------------------
 *  - `Escape` cierra y **devuelve el foco al disparador**. Sin esa devolución
 *    el foco se queda en la nada y el siguiente tabulador empieza desde arriba.
 *  - Flechas arriba/abajo recorren las opciones en ciclo; `Home` y `End` van a
 *    los extremos.
 *  - Abrir con `ArrowDown` (o con `Enter`/`Espacio`, que el navegador ya
 *    convierte en clic) enfoca la primera opción; abrir con `ArrowUp`, la
 *    última. Abrir con el ratón no roba el foco.
 *  - Pulsar fuera o tabular fuera cierra el menú, pero **sin** devolver el
 *    foco: ahí el usuario ya ha decidido irse a otro sitio.
 *
 * El foco se mueve de verdad entre las opciones (`element.focus()`) en vez de
 * usar `aria-activedescendant`: en un menú de botones y enlaces reales es lo
 * que espera el lector de pantalla, y además el foco visible de `:focus-visible`
 * funciona solo. `aria-activedescendant` se queda para el combobox del buscador,
 * donde el foco tiene que permanecer en el campo de texto mientras se escribe.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Elementos que cuentan como opción del menú. */
const OPCIONES = 'a[href],button:not(:disabled),[role="menuitem"]';

export interface MenuControl {
  open: boolean;
  /** Referencia para el botón que abre el menú. */
  triggerRef: React.RefObject<HTMLButtonElement>;
  /** Referencia para el contenedor de las opciones. */
  menuRef: React.RefObject<HTMLDivElement>;
  /** Alterna con ratón: abre sin robar el foco. */
  toggle: () => void;
  /** Cierra. `devolverFoco` por defecto sí: es lo que quiere `Escape`. */
  close: (devolverFoco?: boolean) => void;
  /** Va en el botón: abre con flechas y enfoca el extremo que toque. */
  onTriggerKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  /** Va en el contenedor: flechas, Home/End y Escape. */
  onMenuKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

export function useMenu(): MenuControl {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /** Dónde poner el foco en cuanto el menú aparezca. null = no tocarlo. */
  const focoPendiente = useRef<"primera" | "ultima" | null>(null);

  const opciones = useCallback((): HTMLElement[] => {
    if (!menuRef.current) return [];
    return [...menuRef.current.querySelectorAll<HTMLElement>(OPCIONES)];
  }, []);

  const close = useCallback((devolverFoco = true) => {
    setOpen(false);
    focoPendiente.current = null;
    if (devolverFoco) triggerRef.current?.focus();
  }, []);

  const toggle = useCallback(() => {
    setOpen((o) => {
      if (o) focoPendiente.current = null;
      return !o;
    });
  }, []);

  // El foco se coloca DESPUÉS de pintar: al pulsar la flecha las opciones
  // todavía no existen en el DOM.
  useEffect(() => {
    if (!open || !focoPendiente.current) return;
    const lista = opciones();
    if (!lista.length) return;
    (focoPendiente.current === "ultima" ? lista[lista.length - 1] : lista[0]).focus();
    focoPendiente.current = null;
  }, [open, opciones]);

  // Cerrar al pulsar fuera. Sin devolver el foco: el usuario ya ha ido a otro
  // sitio y arrastrarlo de vuelta al botón sería peor que no hacer nada.
  useEffect(() => {
    if (!open) return;
    function fuera(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [open]);

  // Cerrar al tabular fuera del menú. `focusout` con `relatedTarget` distingue
  // "se ha ido" de "ha saltado a la opción de al lado".
  useEffect(() => {
    if (!open) return;
    function salida(e: FocusEvent) {
      const destino = e.relatedTarget as Node | null;
      if (!destino) return; // el foco se fue de la ventana entera
      if (menuRef.current?.contains(destino) || triggerRef.current?.contains(destino)) return;
      setOpen(false);
    }
    const nodo = menuRef.current;
    nodo?.addEventListener("focusout", salida);
    return () => nodo?.removeEventListener("focusout", salida);
  }, [open]);

  const onTriggerKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      focoPendiente.current = e.key === "ArrowDown" ? "primera" : "ultima";
      setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }, []);

  const onMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const lista = opciones();
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (!lista.length) return;

      const actual = lista.indexOf(document.activeElement as HTMLElement);
      let destino = -1;

      if (e.key === "ArrowDown") destino = actual < 0 ? 0 : (actual + 1) % lista.length;
      else if (e.key === "ArrowUp")
        destino = actual < 0 ? lista.length - 1 : (actual - 1 + lista.length) % lista.length;
      else if (e.key === "Home") destino = 0;
      else if (e.key === "End") destino = lista.length - 1;
      else return;

      e.preventDefault();
      lista[destino].focus();
    },
    [close, opciones]
  );

  return { open, triggerRef, menuRef, toggle, close, onTriggerKeyDown, onMenuKeyDown };
}
