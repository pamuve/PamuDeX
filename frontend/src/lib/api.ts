// Todas las llamadas pasan por /api, que Vite redirige a Express en dev
// y que en producción sirve el propio contenedor. El Service Worker (StaleWhileRevalidate)
// se encarga de que estas respuestas queden disponibles sin conexión tras la primera sincronización.

import { getActiveSessionId } from "./session";
import { getActiveChampionsId } from "./champions";
import { profilesApi, championsApi } from "./apiSession";

/**
 * Añade el parámetro del modo activo, si hay alguno.
 *
 * - `?champions=<id>` en modo Champions (Fase 6.3).
 * - `?session=<id>` con una sesión de ROM Hack activa (Fase 3).
 *
 * **Nunca los dos**: son modos excluyentes, y Champions manda. Entrar en el
 * modo ya pausa la sesión (`lib/champions.ts`), así que en la práctica no
 * coinciden; esto lo deja garantizado también aquí, y el middleware del backend
 * lo vuelve a garantizar por su cuenta.
 *
 * Sin modo activo la URL sale idéntica a la de la Fase 1, así que los dos
 * middlewares hacen `next()` y la API responde el dato global.
 *
 * Cada modo y cada sesión generan URLs distintas, así que el Service Worker las
 * cachea por separado y el modo offline sigue funcionando en cada uno.
 */
function withMode(path: string): string {
  const sep = path.includes("?") ? "&" : "?";

  const championsId = getActiveChampionsId();
  if (championsId !== null) return `${path}${sep}champions=${championsId}`;

  const sessionId = getActiveSessionId();
  if (sessionId !== null) return `${path}${sep}session=${sessionId}`;

  return path;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${withMode(path)}`);
  if (!res.ok) throw new Error(`Error ${res.status} al pedir ${path}`);
  return res.json();
}

/**
 * Generación pedida en una ficha (Fase 7). `null` o sin valor es «la actual», y
 * entonces la URL sale idéntica a la de siempre: el middleware del backend solo
 * añade `has_generational_differences` y no reescribe nada.
 *
 * Va delante de `withMode`, así que cada combinación de generación y modo
 * genera una URL distinta y el Service Worker las cachea por separado — el modo
 * sin conexión sigue funcionando en cada una.
 */
function genQuery(gen?: number | null): string {
  return gen === null || gen === undefined ? "" : `?gen=${gen}`;
}

export const api = {
  types: {
    list: () => get<import("../types").PokeType[]>("/types"),
    detail: (id: string, gen?: number | null) =>
      get<import("../types").TypeDetail>(`/types/${id}${genQuery(gen)}`),
  },
  pokemon: {
    list: () => get<import("../types").PokemonSummary[]>("/pokemon"),
    detail: (id: string | number, gen?: number | null) =>
      get<import("../types").PokemonDetail>(`/pokemon/${id}${genQuery(gen)}`),
  },
  moves: {
    list: () => get<import("../types").MoveSummary[]>("/moves"),
    detail: (id: string | number, gen?: number | null) =>
      get<import("../types").MoveDetail>(`/moves/${id}${genQuery(gen)}`),
  },
  abilities: {
    list: () => get<import("../types").AbilitySummary[]>("/abilities"),
    detail: (id: string | number, gen?: number | null) =>
      get<import("../types").AbilityDetail>(`/abilities/${id}${genQuery(gen)}`),
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
