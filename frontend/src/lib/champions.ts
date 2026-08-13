/**
 * PamuDeX — Tarea 6.3
 * Modo Pokémon Champions activo.
 *
 * POR QUÉ NO ES UN CONTEXT DE REACT, AUNQUE EL ENCARGO DIJERA `championsContext.tsx`
 * ---------------------------------------------------------------------------------
 * `lib/api.ts` tiene que saber si el modo está activo **de forma síncrona en
 * cada petición**, igual que hace con la sesión de ROM Hack, y un módulo que no
 * es un componente no puede leer un context. Por eso esto sigue el patrón que ya
 * usan `lib/session.ts`, `lib/profile.ts` y `lib/favorites.ts`: estado de módulo
 * en `localStorage` + eventos de `window`, con un hook encima para los
 * componentes. Ventaja añadida: no hace falta otro provider en `main.tsx`.
 *
 * SE GUARDA EL CONJUNTO ENTERO, NO SOLO SU id
 * -------------------------------------------
 * La TopBar pinta el nombre del conjunto en el distintivo permanente desde el
 * primer render, y la app es offline-first. Mismo razonamiento que el perfil
 * activo en `lib/profile.ts`.
 *
 * CHAMPIONS Y LAS SESIONES DE ROM HACK SON EXCLUYENTES
 * ----------------------------------------------------
 * Entrar en el modo **pausa** la sesión activa y guarda cuál era para
 * restaurarla al salir. La pausa no toca la preferencia del perfil
 * (`settings.active_session`): se marca como `silent`, igual que hace
 * `lib/settings.ts` al restaurar, para que no se registre como una decisión del
 * usuario. Si no, entrar en el modo borraría el ROM Hack que ese perfil tenía
 * abierto y salir no lo devolvería.
 */

import { useCallback, useEffect, useState } from "react";
import { getActiveSessionId, setActiveSessionId } from "./session";

export const ACTIVE_CHAMPIONS_KEY = "pamudex_champions";
export const PAUSED_SESSION_KEY = "pamudex_champions_paused_session";
export const ACTIVE_CHAMPIONS_EVENT = "pamudex:champions";

/** Lo mínimo que la interfaz necesita saber del conjunto activo. */
export interface ActiveChampions {
  id: number;
  name: string;
}

function isActiveChampions(value: unknown): value is ActiveChampions {
  if (value === null || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === "number" && c.id > 0 && typeof c.name === "string";
}

/** Conjunto de reglas activo, o null si no estamos en modo Champions. */
export function getActiveChampions(): ActiveChampions | null {
  try {
    const raw = localStorage.getItem(ACTIVE_CHAMPIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isActiveChampions(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Atajo para `lib/api.ts`, que solo necesita el id y lo lee en cada petición. */
export function getActiveChampionsId(): number | null {
  const activo = getActiveChampions();
  return activo ? activo.id : null;
}

/** ¿Estamos dentro del modo? */
export function isChampionsMode(): boolean {
  return getActiveChampionsId() !== null;
}

function announce(value: ActiveChampions | null) {
  window.dispatchEvent(new CustomEvent(ACTIVE_CHAMPIONS_EVENT, { detail: value }));
}

/**
 * Entra en el modo Champions con un conjunto de reglas.
 * Pausa la sesión de ROM Hack que hubiera y recuerda cuál era.
 */
export function enterChampions(reglas: ActiveChampions): void {
  const sesion = getActiveSessionId();
  try {
    localStorage.setItem(ACTIVE_CHAMPIONS_KEY, JSON.stringify(reglas));
    if (sesion !== null) localStorage.setItem(PAUSED_SESSION_KEY, String(sesion));
  } catch {
    /* modo privado: se sigue igualmente */
  }
  // `silent`: es una pausa, no que el usuario haya cerrado su ROM Hack.
  if (sesion !== null) setActiveSessionId(null, true);
  announce(reglas);
}

/** Sale del modo y devuelve la sesión de ROM Hack que estuviera pausada. */
export function exitChampions(): void {
  let pausada: number | null = null;
  try {
    const raw = localStorage.getItem(PAUSED_SESSION_KEY);
    const id = raw === null ? NaN : Number.parseInt(raw, 10);
    pausada = Number.isInteger(id) && id > 0 ? id : null;
    localStorage.removeItem(ACTIVE_CHAMPIONS_KEY);
    localStorage.removeItem(PAUSED_SESSION_KEY);
  } catch {
    /* modo privado */
  }
  if (pausada !== null) setActiveSessionId(pausada, true);
  announce(null);
}

/** Refresca el nombre cacheado si el conjunto activo se ha renombrado. */
export function syncActiveChampions(reglas: ActiveChampions): void {
  const actual = getActiveChampions();
  if (!actual || actual.id !== reglas.id) return;
  if (actual.name === reglas.name) return;
  try {
    localStorage.setItem(ACTIVE_CHAMPIONS_KEY, JSON.stringify(reglas));
  } catch {
    /* modo privado */
  }
  announce(reglas);
}

/** Si el conjunto activo ya no existe, se sale del modo. */
export function forgetIfMissing(ids: number[]): void {
  const actual = getActiveChampions();
  if (actual && !ids.includes(actual.id)) exitChampions();
}

/**
 * Hook para leer el modo activo y entrar o salir de él.
 * Se sincroniza entre componentes y entre pestañas del navegador.
 */
export function useActiveChampions(): {
  champions: ActiveChampions | null;
  enter: (reglas: ActiveChampions) => void;
  exit: () => void;
} {
  const [champions, setChampions] = useState<ActiveChampions | null>(() => getActiveChampions());

  useEffect(() => {
    const sync = () => setChampions(getActiveChampions());
    window.addEventListener(ACTIVE_CHAMPIONS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ACTIVE_CHAMPIONS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const enter = useCallback((reglas: ActiveChampions) => enterChampions(reglas), []);
  const exit = useCallback(() => exitChampions(), []);

  return { champions, enter, exit };
}
