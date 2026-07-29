/**
 * PamuDeX — Tarea 3.2
 * Cliente HTTP consciente de la sesión activa.
 *
 * Es un módulo aparte a propósito: todo el código nuevo de la Fase 3 pasa por
 * aquí sin tocar tu `lib/api.ts` de la Fase 1. Para que las páginas antiguas
 * (Pokédex, tipos, /equipo) también respeten la sesión, hay un snippet de dos
 * líneas en `_integracion/api.ts.md`.
 */

import { getActiveSessionId } from "./session";

/** false = forzar datos globales, ignorando la sesión activa. */
export type SessionParam = number | null | false;

export const MULTIPLIERS = [0, 0.25, 0.5, 1, 2, 4] as const;

export interface Session {
  id: number;
  profile_id: number | null;
  name: string;
  description: string | null;
  data_json?: string;
  data?: Record<string, unknown>;
  created_at: string;
}

export interface TypeMeta {
  id: string;
  name_es: string;
  name_en: string;
  color: string;
}

export interface PokemonListItem {
  id: number;
  dex: number;
  name_es: string;
  name_en: string;
  generation: number;
}

export interface PokemonDetail extends PokemonListItem {
  types: unknown;
  abilities: unknown;
  hidden_ability?: unknown;
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  height_m: number;
  weight_kg: number;
  sprite?: string;
  [key: string]: unknown;
}

export interface MoveDetail {
  id: number;
  name_es: string;
  name_en: string;
  type_id: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority?: number;
  makes_contact?: number | boolean;
  effect_es?: string;
  [key: string]: unknown;
}

export interface AbilityDetail {
  id: number;
  name_es: string;
  name_en: string;
  generation?: number;
  effect_es?: string;
  [key: string]: unknown;
}

export interface TypeChartResponse {
  types: TypeMeta[];
  chart: Record<string, Record<string, number>>;
}

/** Añade ?session=<id> salvo que se pidan explícitamente los datos globales. */
export function withSession(path: string, session?: SessionParam): string {
  const id = session === undefined ? getActiveSessionId() : session;
  if (id === false || id === null) return path;
  return path + (path.includes("?") ? "&" : "?") + `session=${id}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  session?: SessionParam
): Promise<T> {
  const url = `/api${withSession(path, session)}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const payload = await res.json();
      if (payload && payload.error) code = String(payload.error);
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(code);
  }
  return (await res.json()) as T;
}

export function apiGet<T>(path: string, opts?: { session?: SessionParam }): Promise<T> {
  return request<T>("GET", path, undefined, opts ? opts.session : undefined);
}

export const sessionsApi = {
  list: () => request<Session[]>("GET", "/sessions", undefined, false),
  get: (id: number) => request<Session>("GET", `/sessions/${id}`, undefined, false),
  create: (name: string, description = "") =>
    request<Session>("POST", "/sessions", { name, description }, false),
  update: (
    id: number,
    patch: { name?: string; description?: string; data?: unknown }
  ) => request<Session>("PUT", `/sessions/${id}`, patch, false),
  duplicate: (id: number) =>
    request<Session>("POST", `/sessions/${id}/duplicate`, undefined, false),
  remove: (id: number) =>
    request<{ ok: boolean; id: number }>("DELETE", `/sessions/${id}`, undefined, false),
};

export const chartApi = {
  get: (session?: SessionParam) =>
    request<TypeChartResponse>("GET", "/chart", undefined, session),
};

export const catalogApi = {
  /** Datos globales, sin overrides: son la referencia contra la que se compara. */
  pokemonList: () => apiGet<PokemonListItem[]>("/pokemon", { session: false }),
  pokemon: (id: number) => apiGet<PokemonDetail>(`/pokemon/${id}`, { session: false }),
  types: () => apiGet<TypeMeta[]>("/types", { session: false }),
  moves: () => apiGet<MoveDetail[]>("/moves", { session: false }),
  move: (id: number) => apiGet<MoveDetail>(`/moves/${id}`, { session: false }),
  abilities: () => apiGet<AbilityDetail[]>("/abilities", { session: false }),
  ability: (id: number) => apiGet<AbilityDetail>(`/abilities/${id}`, { session: false }),
};

/** Nombre de un tipo en el idioma activo. */
export function typeName(type: TypeMeta | undefined, lang?: string): string {
  if (!type) return "";
  return lang === "en" ? type.name_en : type.name_es;
}
