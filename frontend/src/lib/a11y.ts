/**
 * PamuDeX — Tarea 8.1
 * Alto contraste y escalado de texto.
 *
 * POR QUÉ localStorage Y NO EL PERFIL
 * -----------------------------------
 * Mismo patrón que `lib/session.ts`: estado de módulo + eventos de `window`, y
 * `localStorage` como fuente de verdad inmediata. Aquí no es una comodidad, es
 * un requisito: hay que aplicar la clase y el tamaño ANTES del primer render
 * (si no, la app parpadea con el tamaño equivocado) y también en `/perfiles`,
 * donde todavía no hay perfil del que leer nada — que es justo la pantalla
 * donde alguien que necesita alto contraste más lo va a echar de menos.
 *
 * `lib/settings.ts` guarda la copia por perfil (`high_contrast`, `text_scale`)
 * y la restaura al cambiar de uno a otro, exactamente como hace con la sesión
 * de ROM Hack activa. Los cambios que vienen de esa restauración se marcan
 * `silent` para no rebotar de vuelta al servidor.
 *
 * EL ALTO CONTRASTE PISA AL TEMA DE SESIÓN Y AL DE PERFIL
 * ------------------------------------------------------
 * `lib/theme.ts` escribe las `--color-*` como estilo inline en <html>. La regla
 * `.high-contrast` de `index.css` las redeclara con `!important`, que es lo
 * único que gana a un estilo inline. Es deliberado: la identidad visual de un
 * ROM Hack no puede dejar la app ilegible.
 */

import { useCallback, useEffect, useState } from "react";

export const HIGH_CONTRAST_KEY = "pamudex_high_contrast";
export const TEXT_SCALE_KEY = "pamudex_text_scale";
export const A11Y_EVENT = "pamudex:a11y";

/**
 * Los cuatro niveles del encargo, en porcentaje sobre el tamaño de raíz.
 * Son una lista cerrada a propósito: cada uno está comprobado a 320px de ancho,
 * un deslizador libre no lo estaría.
 */
export const TEXT_SCALES = [90, 100, 115, 130] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export const DEFAULT_TEXT_SCALE: TextScale = 100;

export interface A11ySettings {
  highContrast: boolean;
  textScale: TextScale;
}

export const DEFAULT_A11Y: A11ySettings = {
  highContrast: false,
  textScale: DEFAULT_TEXT_SCALE,
};

/** Un número cualquiera al nivel más cercano de la lista, o al de por defecto. */
export function normalizeScale(value: unknown): TextScale {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return DEFAULT_TEXT_SCALE;
  return (TEXT_SCALES as readonly number[]).includes(n) ? (n as TextScale) : DEFAULT_TEXT_SCALE;
}

/** Preferencias guardadas en este navegador. */
export function getA11y(): A11ySettings {
  try {
    return {
      highContrast: localStorage.getItem(HIGH_CONTRAST_KEY) === "1",
      textScale: normalizeScale(localStorage.getItem(TEXT_SCALE_KEY)),
    };
  } catch {
    // Modo privado o almacenamiento bloqueado: la app funciona igual, sin memoria.
    return { ...DEFAULT_A11Y };
  }
}

/**
 * Escribe las preferencias en <html>.
 *
 * El escalado va como `font-size` en la raíz, así que arrastra consigo todos
 * los `rem` de Tailwind (paddings, huecos, anchos máximos): es un zoom
 * coherente y no solo texto más grande dentro de cajas del mismo tamaño, que es
 * lo que rompe los diseños de verdad.
 *
 * Al 100% se BORRA la propiedad en vez de escribir `100%`, para que el tamaño
 * de raíz que haya elegido el usuario en su navegador siga mandando.
 */
export function applyA11y(settings: A11ySettings = getA11y()): void {
  const root = document.documentElement;
  root.classList.toggle("high-contrast", settings.highContrast);
  root.style.fontSize = settings.textScale === DEFAULT_TEXT_SCALE ? "" : `${settings.textScale}%`;
  // Para hojas de estilo y pruebas: el nivel actual, siempre presente.
  root.dataset.textScale = String(settings.textScale);
}

function announce(settings: A11ySettings, silent: boolean) {
  window.dispatchEvent(new CustomEvent(A11Y_EVENT, { detail: { ...settings, silent } }));
}

/**
 * Cambia las dos preferencias de golpe, las aplica y avisa a la app.
 * `silent` marca lo que no ha decidido el usuario (restaurar las de un perfil),
 * para que `lib/settings.ts` no lo vuelva a guardar.
 */
export function setA11y(patch: Partial<A11ySettings>, silent = false): void {
  const next: A11ySettings = { ...getA11y(), ...patch };
  if (patch.textScale !== undefined) next.textScale = normalizeScale(patch.textScale);

  try {
    if (next.highContrast) localStorage.setItem(HIGH_CONTRAST_KEY, "1");
    else localStorage.removeItem(HIGH_CONTRAST_KEY);

    if (next.textScale === DEFAULT_TEXT_SCALE) localStorage.removeItem(TEXT_SCALE_KEY);
    else localStorage.setItem(TEXT_SCALE_KEY, String(next.textScale));
  } catch {
    /* sin almacenamiento: el cambio vale para esta sesión y no se recuerda */
  }

  applyA11y(next);
  announce(next, silent);
}

export function setHighContrast(value: boolean, silent = false): void {
  setA11y({ highContrast: value }, silent);
}

export function setTextScale(value: TextScale, silent = false): void {
  setA11y({ textScale: value }, silent);
}

/** Lee y escribe las preferencias. Se sincroniza entre componentes y pestañas. */
export function useA11y(): [A11ySettings, (patch: Partial<A11ySettings>) => void] {
  const [settings, setSettings] = useState<A11ySettings>(() => getA11y());

  useEffect(() => {
    const sync = () => setSettings(getA11y());
    window.addEventListener(A11Y_EVENT, sync);
    // `storage` solo llega desde OTRA pestaña, y esa no ha tocado nuestro <html>.
    const fromOtherTab = () => applyA11y(getA11y());
    window.addEventListener("storage", sync);
    window.addEventListener("storage", fromOtherTab);
    return () => {
      window.removeEventListener(A11Y_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("storage", fromOtherTab);
    };
  }, []);

  const update = useCallback((patch: Partial<A11ySettings>) => setA11y(patch), []);

  return [settings, update];
}
