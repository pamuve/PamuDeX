// Todas las llamadas pasan por /api, que Vite redirige a Express en dev
// y que en producción sirve el propio contenedor. El Service Worker (StaleWhileRevalidate)
// se encarga de que estas respuestas queden disponibles sin conexión tras la primera sincronización.

import { getActiveSessionId } from "./session";
import { profilesApi, championsApi } from "./apiSession";

/**
 * Añade `?session=<id>` cuando hay una sesión activa (Fase 3).
 *
 * Sin sesión activa la URL sale idéntica a la de la Fase 1, así que el
 * middleware `sessionOverrides` hace `next()` y la API responde el dato global.
 * Con sesión activa, la Pokédex, los tipos y /equipo ven los mismos datos
 * editados que el editor visual.
 *
 * Cada sesión genera URLs distintas, así que el Service Worker las cachea por
 * separado y el modo offline sigue funcionando sesión por sesión.
 */
function withSession(path: string): string {
  const id = getActiveSessionId();
  if (id === null) return path;
  return path + (path.includes("?") ? "&" : "?") + `session=${id}`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${withSession(path)}`);
  if (!res.ok) throw new Error(`Error ${res.status} al pedir ${path}`);
  return res.json();
}

export const api = {
  types: {
    list: () => get<import("../types").PokeType[]>("/types"),
    detail: (id: string) => get<import("../types").TypeDetail>(`/types/${id}`),
  },
  pokemon: {
    list: () => get<import("../types").PokemonSummary[]>("/pokemon"),
    detail: (id: string | number) => get<import("../types").PokemonDetail>(`/pokemon/${id}`),
  },
  moves: {
    list: () => get<import("../types").MoveSummary[]>("/moves"),
    detail: (id: string | number) => get<import("../types").MoveDetail>(`/moves/${id}`),
  },
  abilities: {
    list: () => get<import("../types").AbilitySummary[]>("/abilities"),
    detail: (id: string | number) => get<import("../types").AbilityDetail>(`/abilities/${id}`),
  },
  search: (q: string) => get<import("../types").SearchResults>(`/search?q=${encodeURIComponent(q)}`),

  /**
   * Objetos (Tarea 6.0). A diferencia del resto de listados, este admite
   * filtros: son 2151 entradas y el editor de reglas de Champions (6.1) los
   * necesita por categoría para que marcarlos sea manejable.
   *
   * Pasan por `get()` como todo lo demás, así que llevan `?session=` cuando hay
   * sesión activa. Hoy da igual —el middleware de overrides no toca los
   * objetos—, pero mantiene la URL coherente para cuando lo haga.
   */
  items: {
    list: (opts?: { category?: string; q?: string }) => {
      const params = new URLSearchParams();
      if (opts?.category) params.set("category", opts.category);
      if (opts?.q) params.set("q", opts.q);
      const query = params.toString();
      return get<import("../types").ItemSummary[]>(`/items${query ? `?${query}` : ""}`);
    },
    detail: (id: string | number) => get<import("../types").ItemDetail>(`/items/${id}`),
    categories: () => get<import("../types").ItemCategory[]>("/items/categories"),
  },

  /**
   * Perfiles (Fase 5). La implementación vive en `apiSession.ts`, que es donde
   * está el helper capaz de hacer POST/PUT/DELETE; el `get()` de este archivo
   * solo sabe hacer GET y además añade `?session=`, que aquí no queremos.
   * Se expone desde `api` para que las páginas tengan un único punto de entrada.
   */
  profiles: profilesApi,

  /**
   * Pokémon Champions (Tarea 6.1). Como los perfiles, la implementación está en
   * `apiSession.ts` (es la que sabe hacer POST/PUT/DELETE) y se expone aquí para
   * que las páginas tengan un único punto de entrada.
   *
   * Ojo: `champions.pokemon(id)` y compañía devuelven el catálogo YA FILTRADO
   * por ese conjunto de reglas, con la misma forma que `api.pokemon.list()`.
   */
  champions: championsApi,
};
