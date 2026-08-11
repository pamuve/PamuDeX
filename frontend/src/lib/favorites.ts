/**
 * PamuDeX — Tarea 5.3
 * Favoritos del perfil activo.
 *
 * POR QUÉ UNA CACHÉ DE MÓDULO Y NO UN CONTEXT
 * -------------------------------------------
 * El botón de estrella aparece en cuatro fichas distintas y en /favoritos. Si
 * cada botón preguntase al servidor si su entidad está marcada, entrar en una
 * ficha dispararía una petición por estrella. En su lugar se cargan todos los
 * favoritos del perfil una vez (son pocos) y se guardan en un Set de módulo,
 * con avisos por eventos de `window` — el mismo patrón que `lib/session.ts`,
 * así que no hace falta añadir un provider en main.tsx.
 *
 * ACTUALIZACIÓN OPTIMISTA
 * -----------------------
 * `toggle` cambia el Set al instante y revierte si el servidor falla. El
 * backend es idempotente en POST y DELETE, así que repetir la acción o que se
 * crucen dos pulsaciones no puede dejar datos inconsistentes.
 */

import { useCallback, useEffect, useState } from "react";
import { favoritesApi } from "./apiSession";
import { getActiveProfileId, ACTIVE_PROFILE_EVENT } from "./profile";

export type FavoriteType = "pokemon" | "move" | "ability" | "type";

export const FAVORITES_EVENT = "pamudex:favorites";

/** Clave interna del Set. */
function keyOf(type: FavoriteType, ref: string | number): string {
  return `${type}:${ref}`;
}

/** Favoritos del perfil activo. null = todavía no se han cargado. */
let cache: Set<string> | null = null;
/** Perfil al que corresponde la caché, para detectar cambios de perfil. */
let cacheProfile: number | null = null;
let loading: Promise<void> | null = null;

function announce() {
  window.dispatchEvent(new CustomEvent(FAVORITES_EVENT));
}

/** Descarta la caché (al cambiar de perfil o al salir). */
export function resetFavorites() {
  cache = null;
  cacheProfile = null;
  loading = null;
  announce();
}

/**
 * Carga los favoritos del perfil activo si hacen falta.
 * Varias llamadas simultáneas comparten la misma petición.
 */
export function loadFavorites(): Promise<void> {
  const profileId = getActiveProfileId();

  if (profileId === null) {
    if (cache !== null || cacheProfile !== null) resetFavorites();
    return Promise.resolve();
  }
  if (cache !== null && cacheProfile === profileId) return Promise.resolve();
  if (loading && cacheProfile === profileId) return loading;

  cacheProfile = profileId;
  loading = favoritesApi
    .list(profileId)
    .then((res) => {
      // El perfil pudo cambiar mientras llegaba la respuesta.
      if (cacheProfile !== profileId) return;
      cache = new Set(res.items.map((it) => keyOf(it.entity_type as FavoriteType, it.entity_ref)));
      announce();
    })
    .catch(() => {
      // Sin conexión se trata como "no hay favoritos" en vez de romper la
      // ficha: la app es offline-first y la estrella es secundaria.
      if (cacheProfile === profileId) {
        cache = new Set();
        announce();
      }
    })
    .finally(() => {
      loading = null;
    });

  return loading;
}

/** ¿Está marcada esta entidad? Sin perfil o sin cargar, false. */
export function isFavorite(type: FavoriteType, ref: string | number): boolean {
  return cache !== null && cache.has(keyOf(type, ref));
}

/** Referencias marcadas de un tipo, para /favoritos. */
export function favoritesOf(type: FavoriteType): string[] {
  if (cache === null) return [];
  const prefix = `${type}:`;
  return [...cache].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
}

/**
 * Marca o desmarca. Devuelve el estado resultante.
 * Optimista: cambia primero y revierte si el servidor dice que no.
 */
export async function toggleFavorite(
  type: FavoriteType,
  ref: string | number
): Promise<boolean> {
  const profileId = getActiveProfileId();
  if (profileId === null) return false;

  if (cache === null) cache = new Set();

  const key = keyOf(type, ref);
  const wasFavorite = cache.has(key);
  const next = !wasFavorite;

  // Optimista
  if (next) cache.add(key);
  else cache.delete(key);
  announce();

  try {
    if (next) await favoritesApi.add(profileId, type, ref);
    else await favoritesApi.remove(profileId, type, ref);
    return next;
  } catch {
    // Revertir
    if (cache) {
      if (wasFavorite) cache.add(key);
      else cache.delete(key);
    }
    announce();
    throw new Error("favorites.toggleError");
  }
}

/** Se vuelve a renderizar cuando cambian los favoritos o el perfil activo. */
function useFavoritesTick(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const onProfile = () => {
      resetFavorites();
      loadFavorites();
    };
    window.addEventListener(FAVORITES_EVENT, bump);
    window.addEventListener(ACTIVE_PROFILE_EVENT, onProfile);
    window.addEventListener("storage", onProfile);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, bump);
      window.removeEventListener(ACTIVE_PROFILE_EVENT, onProfile);
      window.removeEventListener("storage", onProfile);
    };
  }, []);

  return tick;
}

/** Estado de una entidad concreta, para el botón de estrella. */
export function useFavorite(type: FavoriteType, ref: string | number | undefined) {
  useFavoritesTick();

  useEffect(() => {
    loadFavorites();
  }, []);

  const active = ref !== undefined && isFavorite(type, ref);

  const toggle = useCallback(() => {
    if (ref === undefined) return Promise.resolve(false);
    return toggleFavorite(type, ref);
  }, [type, ref]);

  return { isFavorite: active, toggle, enabled: getActiveProfileId() !== null };
}

/** Todos los favoritos ya agrupados, para la página /favoritos. */
export function useAllFavorites() {
  useFavoritesTick();
  const [ready, setReady] = useState(cache !== null);

  useEffect(() => {
    loadFavorites().then(() => setReady(true));
  }, []);

  return {
    ready,
    pokemon: favoritesOf("pokemon"),
    move: favoritesOf("move"),
    ability: favoritesOf("ability"),
    type: favoritesOf("type"),
    total:
      favoritesOf("pokemon").length +
      favoritesOf("move").length +
      favoritesOf("ability").length +
      favoritesOf("type").length,
  };
}
