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
import type { Profile } from "./profile";

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
  makes_contact?: number | boolean | null;
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

/**
 * Error de la API. `message` sigue siendo el código de error, como siempre, así
 * que el código que ya existía no cambia. `payload` añade el cuerpo completo
 * para los casos que necesitan más datos (por ejemplo `retry_after` cuando el
 * límite de intentos del PIN bloquea).
 */
export class ApiError extends Error {
  payload: Record<string, unknown>;
  status: number;

  constructor(code: string, status: number, payload: Record<string, unknown>) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
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
    let payload: Record<string, unknown> = {};
    try {
      payload = await res.json();
      if (payload && payload.error) code = String(payload.error);
    } catch {
      /* sin cuerpo JSON */
    }
    throw new ApiError(code, res.status, payload);
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

/**
 * Perfiles (Fase 5). Van con `session: false` a propósito: un perfil no
 * depende de la sesión de ROM Hack activa. Añadir `?session=` generaría una URL
 * distinta por sesión, que el Service Worker cachearía por separado sin ninguna
 * ganancia. El middleware `sessionOverrides` tampoco toca `/profiles` — su
 * regex solo cubre types/pokemon/moves/abilities y /search.
 */
export const profilesApi = {
  list: () => request<Profile[]>("GET", "/profiles", undefined, false),
  get: (id: number) => request<Profile>("GET", `/profiles/${id}`, undefined, false),
  palette: () =>
    request<{ palette: string[]; suggested: string }>(
      "GET",
      "/profiles/palette",
      undefined,
      false
    ),
  create: (data: { name: string; avatar?: string | null; color?: string }) =>
    request<Profile>("POST", "/profiles", data, false),
  update: (
    id: number,
    patch: { name?: string; avatar?: string | null; color?: string; language?: string; theme?: string }
  ) => request<Profile>("PUT", `/profiles/${id}`, patch, false),
  remove: (id: number) =>
    request<{ ok: boolean; id: number; sessions_borradas: number }>(
      "DELETE",
      `/profiles/${id}`,
      undefined,
      false
    ),

  /* --- PIN de perfil (Tarea 5.2) --------------------------------------- */

  /** Comprueba el PIN para entrar. Lanza "pin_incorrecto" o "demasiados_intentos". */
  verifyPin: (id: number, pin: string) =>
    request<{ ok: boolean; profile: Profile }>("POST", `/profiles/${id}/verify`, { pin }, false),

  /** Establece o cambia el PIN. `current` es obligatorio si ya había uno. */
  setPin: (id: number, pin: string, current?: string) =>
    request<{ ok: boolean; profile: Profile }>(
      "POST",
      `/profiles/${id}/password`,
      current === undefined ? { pin } : { pin, current },
      false
    ),

  /** Quita el PIN. Exige conocer el actual. */
  removePin: (id: number, current: string) =>
    request<{ ok: boolean; profile: Profile }>(
      "DELETE",
      `/profiles/${id}/password`,
      { current },
      false
    ),
};

/**
 * Favoritos por perfil (Tarea 5.3). Como los perfiles, van con `session: false`:
 * un favorito no depende de la sesión de ROM Hack activa. El perfil viaja como
 * `?profile=<id>`, igual que las sesiones usan `?session=`.
 *
 * La API devuelve REFERENCIAS, no nombres: los resuelve el frontend con los
 * listados que ya tiene cacheados, y así los favoritos respetan los overrides
 * de la sesión activa sin lógica adicional.
 */
export interface FavoriteItem {
  id: number;
  entity_type: string;
  entity_ref: string;
  created_at: string;
}

export const favoritesApi = {
  list: (profileId: number) =>
    request<{ profile_id: number; items: FavoriteItem[]; byType: Record<string, string[]> }>(
      "GET",
      `/favorites?profile=${profileId}`,
      undefined,
      false
    ),
  add: (profileId: number, entityType: string, entityRef: string | number) =>
    request<{ ok: boolean; favorite: boolean; creado: boolean }>(
      "POST",
      `/favorites?profile=${profileId}`,
      { entity_type: entityType, entity_ref: entityRef },
      false
    ),
  remove: (profileId: number, entityType: string, entityRef: string | number) =>
    request<{ ok: boolean; favorite: boolean; borrado: boolean }>(
      "DELETE",
      `/favorites?profile=${profileId}`,
      { entity_type: entityType, entity_ref: entityRef },
      false
    ),
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
