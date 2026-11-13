/**
 * PamuDeX — opciones de la sesión de ROM Hack activa (Fase 9).
 *
 * Viven en `sessions.data_json.options`, junto a los overrides y el tema. Hoy
 * hay una:
 *
 *   any_move   en este ROM Hack cualquier Pokémon puede aprender cualquier
 *              movimiento, así que la lista de «movimientos que aprende» del
 *              dataset no manda: el comparador no filtra y la ficha lo avisa.
 *
 * Las leen páginas que NO son el editor (la ficha, el comparador, la
 * calculadora), así que no pueden usar `useSessionOverrides`, que carga y
 * guarda el documento entero. Aquí solo se lee, con una copia por sesión que se
 * tira cuando `lib/localCache.ts` anuncia un cambio (el editor lo hace al
 * guardar).
 */
import { useEffect, useState } from "react";
import { sessionsApi } from "./apiSession";
import { useActiveSession } from "./session";
import { useActiveChampions } from "./champions";
import { CACHE_EVENT } from "./localCache";

export interface SessionOptions {
  any_move?: boolean;
}

const copias = new Map<number, Promise<SessionOptions>>();

if (typeof window !== "undefined") {
  window.addEventListener(CACHE_EVENT, () => copias.clear());
}

function leer(sessionId: number): Promise<SessionOptions> {
  let copia = copias.get(sessionId);
  if (!copia) {
    copia = sessionsApi
      .get(sessionId)
      .then((s) => {
        const options = s.data && typeof s.data === "object" ? (s.data as { options?: unknown }).options : null;
        return options && typeof options === "object" ? (options as SessionOptions) : {};
      })
      .catch(() => {
        copias.delete(sessionId); // sin red: que el siguiente intento vuelva a preguntar
        return {};
      });
    copias.set(sessionId, copia);
  }
  return copia;
}

export function useSessionOptions(): SessionOptions {
  const [sessionId] = useActiveSession();
  const { champions } = useActiveChampions();
  const [options, setOptions] = useState<SessionOptions>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onCache = () => setTick((n) => n + 1);
    window.addEventListener(CACHE_EVENT, onCache);
    return () => window.removeEventListener(CACHE_EVENT, onCache);
  }, []);

  useEffect(() => {
    // En Champions la sesión está en pausa: sus opciones no aplican.
    if (sessionId === null || champions) {
      setOptions({});
      return;
    }
    let cancelado = false;
    leer(sessionId).then((o) => !cancelado && setOptions(o));
    return () => {
      cancelado = true;
    };
  }, [sessionId, champions, tick]);

  return options;
}
