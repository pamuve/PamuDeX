/**
 * PamuDeX — Tarea 3.1
 * Sesión activa guardada en localStorage.
 *
 * La tarea 3.2 leerá getActiveSessionId() desde api.ts para añadir ?session=<id>
 * a todas las llamadas, así que toda la app debe pasar por aquí y no leer la
 * clave de localStorage por su cuenta.
 */

import { useCallback, useEffect, useState } from "react";

export const ACTIVE_SESSION_KEY = "pamudex_active_session";
export const ACTIVE_SESSION_EVENT = "pamudex:active-session";

/** Devuelve el id de la sesión activa, o null si se está usando el dataset global. */
export function getActiveSessionId(): number | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const id = Number.parseInt(raw, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** Cambia la sesión activa (null = datos globales) y avisa a toda la app. */
export function setActiveSessionId(id: number | null): void {
  try {
    if (id === null) localStorage.removeItem(ACTIVE_SESSION_KEY);
    else localStorage.setItem(ACTIVE_SESSION_KEY, String(id));
  } catch {
    /* modo privado / almacenamiento lleno: seguimos igualmente */
  }
  window.dispatchEvent(new CustomEvent(ACTIVE_SESSION_EVENT, { detail: id }));
}

/**
 * Hook para leer y escribir la sesión activa.
 * Se sincroniza entre componentes y entre pestañas del navegador.
 */
export function useActiveSession(): [number | null, (id: number | null) => void] {
  const [sessionId, setSessionId] = useState<number | null>(() => getActiveSessionId());

  useEffect(() => {
    const sync = () => setSessionId(getActiveSessionId());
    window.addEventListener(ACTIVE_SESSION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ACTIVE_SESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const select = useCallback((id: number | null) => setActiveSessionId(id), []);

  return [sessionId, select];
}
