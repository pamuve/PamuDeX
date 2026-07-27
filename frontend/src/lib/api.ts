// Todas las llamadas pasan por /api, que Vite redirige a Express en dev
// y que en producción sirve el propio contenedor. El Service Worker (StaleWhileRevalidate)
// se encarga de que estas respuestas queden disponibles sin conexión tras la primera sincronización.

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
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
};