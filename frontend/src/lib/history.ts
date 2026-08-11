/**
 * PamuDeX — Tarea 5.4
 * Historial de consultas del perfil activo.
 *
 * QUIÉN DEDUPLICA
 * ---------------
 * La regla de verdad ("la misma ficha no se registra dos veces en menos de 5
 * minutos") la aplica `backend/routes/history.js`, porque es la única que ve
 * todas las pestañas y dispositivos. Aquí hay una segunda barrera, en memoria,
 * con la única intención de no disparar una petición por cada re-render o por
 * cada ida y vuelta con el botón "atrás". Si esta falla no pasa nada: el
 * backend descarta el duplicado igual.
 *
 * REGISTRAR NUNCA DEBE ROMPER UNA FICHA
 * -------------------------------------
 * `registrar()` no devuelve promesa ni lanza: si no hay perfil, si el perfil
 * desactivó el historial o si no hay red, la visita simplemente no se anota. La
 * ficha es lo importante; el historial es un extra.
 */

import { useEffect, useState } from "react";
import { historyApi, type HistoryItem } from "./apiSession";
import { getActiveProfileId, ACTIVE_PROFILE_EVENT } from "./profile";
import { loadSettings, isHistoryEnabled } from "./settings";
import type { FavoriteType } from "./favorites";

/** Los mismos cuatro tipos que los favoritos. */
export type HistoryType = FavoriteType;

export type { HistoryItem };

export const HISTORY_EVENT = "pamudex:history";

/** Misma ventana que el backend, para no mandar peticiones que va a descartar. */
const DEDUPE_MS = 5 * 60 * 1000;

/** Última vez que se envió cada entidad, por perfil. */
const enviado = new Map<string, number>();

function announce() {
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
}

/**
 * Anota que se ha abierto una ficha. No espera respuesta ni propaga errores.
 */
export function registrar(type: HistoryType, ref: string | number): void {
  const profileId = getActiveProfileId();
  if (profileId === null) return;

  const key = `${profileId}:${type}:${ref}`;
  const ahora = Date.now();
  const ultimo = enviado.get(key);
  if (ultimo !== undefined && ahora - ultimo < DEDUPE_MS) return;
  enviado.set(key, ahora);

  // Los ajustes dicen si este perfil quiere historial. loadSettings() cachea,
  // así que esto no es una petición por ficha.
  loadSettings()
    .then(() => {
      if (!isHistoryEnabled()) return;
      return historyApi.add(profileId, type, ref).then((res) => {
        // Solo se avisa si de verdad se anotó, para que /historial no se
        // recargue cuando el backend ha descartado la visita.
        if (res.registrado) announce();
      });
    })
    .catch(() => {
      // Sin conexión: se olvida la marca para reintentarlo en la siguiente visita.
      enviado.delete(key);
    });
}

/** Olvida las marcas locales (al limpiar el historial o cambiar de perfil). */
export function resetHistoryGuard(): void {
  enviado.clear();
}

/**
 * Registra la visita a una ficha. Es lo único que tienen que añadir las
 * páginas de detalle: una línea, sin estado ni interfaz.
 */
export function useRecordVisit(type: HistoryType, ref: string | number | undefined): void {
  useEffect(() => {
    if (ref === undefined || ref === "") return;
    registrar(type, ref);
  }, [type, ref]);
}

/** Historial del perfil activo, para la página /historial. */
export function useHistory(limit?: number) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function cargar() {
      const profileId = getActiveProfileId();
      if (profileId === null) {
        if (!cancelled) {
          setItems([]);
          setReady(true);
        }
        return;
      }
      try {
        const res = await historyApi.list(profileId, limit);
        if (!cancelled) {
          setItems(res.items);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    cargar();
    const recargar = () => cargar();
    window.addEventListener(HISTORY_EVENT, recargar);
    window.addEventListener(ACTIVE_PROFILE_EVENT, recargar);
    return () => {
      cancelled = true;
      window.removeEventListener(HISTORY_EVENT, recargar);
      window.removeEventListener(ACTIVE_PROFILE_EVENT, recargar);
    };
  }, [limit]);

  return { items, ready, error };
}

/** Borra el historial del perfil activo. La confirmación la pide la página. */
export async function clearHistory(): Promise<number> {
  const profileId = getActiveProfileId();
  if (profileId === null) return 0;

  const res = await historyApi.clear(profileId);
  resetHistoryGuard();
  announce();
  return res.borradas;
}

/**
 * Convierte el `viewed_at` de SQLite en Date.
 *
 * SQLite guarda 'YYYY-MM-DD HH:MM:SS' en UTC y sin marca de zona. Pasar esa
 * cadena tal cual a `new Date()` la interpreta como hora LOCAL, así que el
 * historial saldría desplazado (dos horas en verano peninsular). Hay que
 * normalizarla a ISO con la Z.
 */
export function parseViewedAt(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}
