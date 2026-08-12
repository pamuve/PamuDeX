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

/**
 * Historial de consultas por perfil (Tarea 5.4). Mismo criterio que favoritos:
 * `session: false` y el perfil en `?profile=<id>`. Devuelve REFERENCIAS, no
 * nombres — los resuelve la página con los listados ya cacheados, así que el
 * historial también respeta los overrides de la sesión activa.
 */
export interface HistoryItem {
  id: number;
  entity_type: string;
  /** Cadena siempre: los tipos usan ids de texto ('fuego') y el resto enteros. */
  entity_ref: string;
  /** UTC en formato 'YYYY-MM-DD HH:MM:SS' (lo que guarda SQLite). */
  viewed_at: string;
}

export const historyApi = {
  list: (profileId: number, limit?: number) =>
    request<{ profile_id: number; limit: number; items: HistoryItem[] }>(
      "GET",
      `/history?profile=${profileId}${limit ? `&limit=${limit}` : ""}`,
      undefined,
      false
    ),
  /** `registrado: false` = la ruta lo descartó por duplicado reciente. */
  add: (profileId: number, entityType: string, entityRef: string | number) =>
    request<{ ok: boolean; registrado: boolean }>(
      "POST",
      `/history?profile=${profileId}`,
      { entity_type: entityType, entity_ref: entityRef },
      false
    ),
  clear: (profileId: number) =>
    request<{ ok: boolean; borradas: number }>(
      "DELETE",
      `/history?profile=${profileId}`,
      undefined,
      false
    ),
};

/**
 * Ajustes por perfil (Tarea 5.4). Aquí NO están el idioma ni el tema: viven en
 * `profiles.language` y `profiles.theme`, que viajan dentro del perfil cacheado
 * y por tanto están disponibles en el primer render y sin conexión.
 *
 * El perfil va en la URL y no en la query porque esto es un único documento que
 * pertenece al perfil, no una colección filtrada por él.
 */
export interface ProfileSettings {
  /** Id de la sesión de ROM Hack de este perfil. "" = ninguna. */
  active_session: string;
  /** "1" | "0" — permite desactivar el registro de visitas. */
  history_enabled: string;
}

export const settingsApi = {
  get: (profileId: number) =>
    request<{ profile_id: number; settings: ProfileSettings }>(
      "GET",
      `/settings/${profileId}`,
      undefined,
      false
    ),
  /** Fusiona: lo que no se envía conserva su valor. `null` borra la clave. */
  update: (profileId: number, patch: Partial<Record<keyof ProfileSettings, string | number | boolean | null>>) =>
    request<{ profile_id: number; settings: ProfileSettings }>(
      "PUT",
      `/settings/${profileId}`,
      patch,
      false
    ),
};

/**
 * Conjuntos de reglas de Pokémon Champions (Tarea 6.1).
 *
 * Van con `session: false`: Champions y las sesiones de ROM Hack son modos
 * **excluyentes** (ver `docs/tasks/fase6/00-preparacion.md`), así que añadir
 * `?session=` no significaría nada y solo fragmentaría la caché del SW.
 *
 * `allowed.<entidad>` es `null` cuando NO hay restricción (vale todo el
 * catálogo) y un array de ids cuando la hay. **`null` y `[]` son cosas
 * distintas**: `[]` es «nada permitido». `counts` refleja lo mismo en número.
 */
export type ChampionsEntity = "pokemon" | "moves" | "abilities" | "items";

export interface ChampionsAllowed {
  pokemon: number[] | null;
  moves: number[] | null;
  abilities: number[] | null;
  items: number[] | null;
}

export interface ChampionsCounts {
  pokemon: number | null;
  moves: number | null;
  abilities: number | null;
  items: number | null;
}

/** Lo que devuelve el listado: sin los ids, que pueden ser miles. */
export interface ChampionsRulesSummary {
  id: number;
  name: string;
  counts: ChampionsCounts;
}

/**
 * Multiplicadores propios del modo (Tarea 6.2).
 *
 * Las **claves son canónicas** y no cambian nunca: son las que compara
 * `lib/damage.ts` y con las que `EffectivenessPanel` elige etiqueta y color. Un
 * conjunto de reglas solo redefine el NÚMERO de cada categoría.
 */
export type MultiplierKey =
  | "hiper_eficaz"
  | "super_eficaz"
  | "normal"
  | "poco_eficaz"
  | "muy_poco_eficaz"
  | "sin_efecto";

export type ChampionsMultipliers = Record<MultiplierKey, number>;

/** Orden en que se pintan, de más a menos eficaz. Lo mismo que en el backend. */
export const MULTIPLIER_KEYS: MultiplierKey[] = [
  "hiper_eficaz",
  "super_eficaz",
  "normal",
  "poco_eficaz",
  "muy_poco_eficaz",
  "sin_efecto",
];

export interface ChampionsRules extends ChampionsRulesSummary {
  allowed: ChampionsAllowed;
  /**
   * Tabla COMPLETA: el backend rellena con los valores de siempre lo que el
   * conjunto no personalice, así que el frontend nunca necesita conocerlos.
   */
  multipliers: ChampionsMultipliers;
  /** `true` si el conjunto se aparta de los valores por defecto. */
  multipliers_custom: boolean;
}

export const championsApi = {
  list: () => request<ChampionsRulesSummary[]>("GET", "/champions", undefined, false),
  get: (id: number) => request<ChampionsRules>("GET", `/champions/${id}`, undefined, false),
  create: (name: string) => request<ChampionsRules>("POST", "/champions", { name }, false),
  /**
   * Parcial: lo que no se envía conserva su valor.
   * En `multipliers`, `null` restablece los valores de siempre.
   */
  update: (
    id: number,
    patch: {
      name?: string;
      allowed?: Partial<ChampionsAllowed>;
      multipliers?: Partial<ChampionsMultipliers> | null;
    }
  ) => request<ChampionsRules>("PUT", `/champions/${id}`, patch, false),
  remove: (id: number) =>
    request<{ ok: boolean; id: number }>("DELETE", `/champions/${id}`, undefined, false),

  /**
   * Catálogo ya filtrado. Devuelve exactamente la misma forma que los listados
   * normales, para que la 6.3 pueda reutilizar componentes sin adaptarlos.
   */
  pokemon: (id: number) => apiGet<PokemonListItem[]>(`/champions/${id}/pokemon`, { session: false }),
  /**
   * Fichas del modo: la misma forma que `/api/pokemon/:id` y `/api/types/:id`,
   * pero con la efectividad calculada con los multiplicadores del conjunto.
   * Un Pokémon no permitido responde 404: en este modo no existe.
   */
  pokemonDetail: (id: number, pokeId: string | number) =>
    apiGet<PokemonDetail>(`/champions/${id}/pokemon/${pokeId}`, { session: false }),
  typeDetail: (id: number, typeId: string) =>
    apiGet<import("../types").TypeDetail>(`/champions/${id}/types/${typeId}`, { session: false }),
  moves: (id: number) => apiGet<MoveDetail[]>(`/champions/${id}/moves`, { session: false }),
  abilities: (id: number) =>
    apiGet<AbilityDetail[]>(`/champions/${id}/abilities`, { session: false }),
  items: (id: number) =>
    apiGet<import("../types").ItemSummary[]>(`/champions/${id}/items`, { session: false }),
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
  /** Objetos (6.0). El editor de reglas de Champions los pide sin sesión. */
  items: () => apiGet<import("../types").ItemSummary[]>("/items", { session: false }),
};

/** Nombre de un tipo en el idioma activo. */
export function typeName(type: TypeMeta | undefined, lang?: string): string {
  if (!type) return "";
  return lang === "en" ? type.name_en : type.name_es;
}
