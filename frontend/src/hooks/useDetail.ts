import { useEffect, useState } from "react";
import { ApiError, esFalloDeRed } from "../lib/api";

/**
 * Por qué no ha cargado algo (8.4):
 * - `red`: no se ha podido preguntar (sin cobertura, servidor caído).
 * - `noEncontrado`: el servidor respondió 404. En Champions es «no permitida».
 * - `otro`: cualquier otra respuesta de error del servidor.
 */
export type Fallo = "red" | "noEncontrado" | "otro";

export function clasificarFallo(err: unknown): Fallo {
  if (esFalloDeRed(err)) return "red";
  return err instanceof ApiError && err.status === 404 ? "noEncontrado" : "otro";
}

/**
 * Carga de una ficha: el patrón que repetían las cuatro páginas de detalle.
 *
 * `deps` decide cuándo se vuelve a pedir (el id y la generación). La respuesta
 * de una petición ya superada se descarta: pulsar rápido varias generaciones
 * deja peticiones en vuelo que pueden resolverse en otro orden.
 *
 * El dato anterior se conserva mientras llega el nuevo, así que cambiar de
 * generación no hace parpadear la ficha entera.
 */
export function useDetail<T>(cargar: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [fallo, setFallo] = useState<Fallo | null>(null);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    setFallo(null);
    let cancelado = false;
    cargar()
      .then((d) => !cancelado && setData(d))
      .catch((err) => !cancelado && setFallo(clasificarFallo(err)));
    return () => {
      cancelado = true;
    };
  }, [...deps, reintento]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, fallo, reintentar: () => setReintento((n) => n + 1) };
}
