/**
 * PamuDeX — utilidades sobre el listado de la Pokédex (Fase 9): leer los tipos
 * de una entrada, filtrar y ordenar.
 */
import type { PokemonSummary, PokeType, StatKey } from "../types";

/**
 * Los ids de tipo de una entrada del listado.
 *
 * El backend los manda como ids (`["planta", "veneno"]`), pero si la sesión de
 * ROM Hack ha cambiado los tipos de ese Pokémon, el override SUSTITUYE el campo
 * por la forma de la ficha: objetos `{ id, name_es, … }`. Aquí se aceptan las
 * dos, que es lo que permite filtrar por el tipo que tiene en el hack.
 */
export function typeIdsOf(p: { types?: (string | PokeType)[] }): string[] {
  return (p.types || [])
    .map((t) => (typeof t === "string" ? t : t && t.id))
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.toLowerCase());
}

export function statTotal(p: PokemonSummary): number {
  const s = p.stats;
  return s ? s.hp + s.atk + s.def + s.spa + s.spd + s.spe : 0;
}

export type SortKey = "dex" | "name" | "total" | StatKey;
export type CaptureFilter = "all" | "captured" | "missing";

export interface PokedexFilters {
  types: string[]; // hasta 2: el Pokémon debe tener TODOS
  generation: number | null;
  sort: SortKey;
  desc: boolean;
  capture: CaptureFilter;
}

export const NO_FILTERS: PokedexFilters = { types: [], generation: null, sort: "dex", desc: false, capture: "all" };

export function hasActiveFilters(f: PokedexFilters): boolean {
  return f.types.length > 0 || f.generation !== null || f.sort !== "dex" || f.desc || f.capture !== "all";
}

export function applyFilters(
  list: PokemonSummary[],
  f: PokedexFilters,
  nameOf: (p: PokemonSummary) => string,
  isCaptured: (id: number) => boolean
): PokemonSummary[] {
  let out = list;
  if (f.types.length) {
    out = out.filter((p) => {
      const ids = typeIdsOf(p);
      return f.types.every((t) => ids.includes(t));
    });
  }
  if (f.generation !== null) out = out.filter((p) => p.generation === f.generation);
  if (f.capture !== "all") out = out.filter((p) => isCaptured(p.id) === (f.capture === "captured"));

  if (f.sort === "dex" && !f.desc) return out;

  // Siempre sobre una COPIA: el listado que devuelve la API es compartido.
  const valor = (p: PokemonSummary): number | string => {
    if (f.sort === "dex") return p.dex;
    if (f.sort === "name") return nameOf(p);
    if (f.sort === "total") return statTotal(p);
    return p.stats ? p.stats[f.sort] : 0;
  };
  const sorted = [...out].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : (va as number) - (vb as number);
    return cmp || a.dex - b.dex;
  });
  // Las stats se miran de mayor a menor por defecto; `desc` invierte lo natural.
  const mayorPrimero = f.sort !== "dex" && f.sort !== "name";
  return mayorPrimero !== f.desc ? sorted.reverse() : sorted;
}
