/**
 * PamuDeX — Tarea 8.4
 * Medición del tiempo hasta tener el catálogo en pantalla.
 *
 * QUÉ SE MIDE, EXACTAMENTE
 * ........................
 * El requisito del proyecto es «los datos ya almacenados localmente se muestran
 * en menos de 100 ms». Eso son dos cosas distintas y se guardan las dos:
 *
 *  - `ms`: lo que tarda la lectura en sí (IndexedDB o red). Es el número que
 *    hay que comparar con los 100 ms, porque es el que depende de la caché.
 *  - `desdeNavegacion`: `performance.now()` en el momento del pintado, que en
 *    una página es el tiempo transcurrido desde el inicio de la navegación.
 *    Incluye descargar y arrancar React, así que es mayor y solo tiene sentido
 *    en la PRIMERA lectura tras cargar la página.
 *
 * «PINTADO» ES UNA APROXIMACIÓN, Y CONVIENE SABERLO
 * .................................................
 * Se toma en el segundo `requestAnimationFrame` tras resolverse la promesa: la
 * página que pidió los datos hace su `setState` en el `.then`, React repinta en
 * el fotograma siguiente y para el segundo ya está en pantalla. No es un
 * `element timing` de verdad, pero no exige instrumentar cada página y el error
 * es de un fotograma.
 *
 * Se guardan las últimas medidas en memoria, no en disco: son de diagnóstico y
 * persistirlas solo serviría para mirar números de otra sesión.
 */

/** De dónde salieron los datos. */
export type OrigenDatos = "local" | "red";

export interface Medida {
  ruta: string;
  origen: OrigenDatos;
  /** Duración de la lectura, en milisegundos. */
  ms: number;
  /** `performance.now()` al pintar: tiempo desde el inicio de la navegación. */
  desdeNavegacion: number;
  cuando: number;
}

/** El listón del proyecto para datos ya cacheados. */
export const OBJETIVO_MS = 100;

const MAX_MEDIDAS = 20;
const medidas: Medida[] = [];

export const PERF_EVENT = "pamudex:perf";

/**
 * Anota una lectura. `inicio` es el `performance.now()` de justo antes de
 * pedirla; la medida se cierra cuando el navegador ha pintado.
 */
export function anotar(ruta: string, origen: OrigenDatos, inicio: number): void {
  const ms = performance.now() - inicio;
  let cerrada = false;

  const cerrar = () => {
    if (cerrada) return;
    cerrada = true;
    medidas.unshift({
      ruta,
      origen,
      ms,
      desdeNavegacion: performance.now(),
      cuando: Date.now(),
    });
    if (medidas.length > MAX_MEDIDAS) medidas.length = MAX_MEDIDAS;
    window.dispatchEvent(new CustomEvent(PERF_EVENT));
  };

  // Con la pestaña en segundo plano el navegador NO ejecuta
  // `requestAnimationFrame`: no hay fotogramas que componer. Esperar al pintado
  // ahí dejaría la medida colgada para siempre, y además «hasta pintarlo» no
  // significa nada si no se pinta. Se cierra en el momento.
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    cerrar();
    return;
  }

  if (typeof requestAnimationFrame !== "function") {
    cerrar();
    return;
  }

  requestAnimationFrame(() => requestAnimationFrame(cerrar));
  // Red de seguridad por si la pestaña se esconde entre medias: la medida se
  // anota igualmente, solo que sin esperar al fotograma.
  setTimeout(cerrar, 250);
}

/** Últimas medidas, de la más reciente a la más antigua. */
export function historial(): Medida[] {
  return [...medidas];
}

export function limpiarMedidas(): void {
  medidas.length = 0;
  window.dispatchEvent(new CustomEvent(PERF_EVENT));
}

/** Resumen de las lecturas servidas desde la caché local. */
export function resumenLocal(): { n: number; media: number; peor: number; cumple: boolean } | null {
  const locales = medidas.filter((m) => m.origen === "local");
  if (!locales.length) return null;
  const total = locales.reduce((a, m) => a + m.ms, 0);
  const peor = locales.reduce((a, m) => Math.max(a, m.ms), 0);
  return {
    n: locales.length,
    media: total / locales.length,
    peor,
    cumple: peor < OBJETIVO_MS,
  };
}
