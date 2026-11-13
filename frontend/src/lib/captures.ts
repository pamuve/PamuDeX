/**
 * PamuDeX — seguimiento de partida (Fase 9): qué Pokémon están capturados.
 *
 * Mismo patrón que `lib/favorites.ts`: una caché de módulo con el conjunto
 * entero, que se pide una vez y se actualiza de forma optimista. La diferencia
 * es que aquí la clave es perfil + ÁMBITO (`lib/scope.ts`): cada ROM Hack lleva
 * su propia partida.
 */
import { useCallback, useEffect, useState } from "react";
import { capturesApi } from "./apiSession";
import { getActiveProfileId, ACTIVE_PROFILE_EVENT } from "./profile";
import { ACTIVE_SESSION_EVENT } from "./session";
import { ACTIVE_CHAMPIONS_EVENT } from "./champions";
import { currentScope } from "./scope";

export const CAPTURES_EVENT = "pamudex:captures";

let cache: Set<number> | null = null;
let cacheKey: string | null = null;
let loading: Promise<void> | null = null;

function keyNow(): string | null {
  const profileId = getActiveProfileId();
  return profileId === null ? null : `${profileId}|${currentScope()}`;
}

function announce() {
  window.dispatchEvent(new CustomEvent(CAPTURES_EVENT));
}

export function loadCaptures(): Promise<void> {
  const key = keyNow();
  if (key === null) {
    if (cache !== null) {
      cache = null;
      cacheKey = null;
      announce();
    }
    return Promise.resolve();
  }
  if (cache !== null && cacheKey === key) return Promise.resolve();
  if (loading && cacheKey === key) return loading;

  cache = null;
  cacheKey = key;
  const profileId = getActiveProfileId() as number;
  loading = capturesApi
    .list(profileId, currentScope())
    .then((res) => {
      if (cacheKey !== key) return;
      cache = new Set(res.pokemon);
      announce();
    })
    .catch(() => {
      // Sin red y sin copia: se trabaja con un conjunto vacío en vez de dejar
      // los botones esperando para siempre.
      if (cacheKey === key) {
        cache = new Set();
        announce();
      }
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

export function isCaptured(pokemonId: number): boolean {
  return cache !== null && cacheKey === keyNow() && cache.has(pokemonId);
}

export function capturedCount(): number {
  return cache !== null && cacheKey === keyNow() ? cache.size : 0;
}

export async function toggleCaptured(pokemonId: number): Promise<boolean> {
  const profileId = getActiveProfileId();
  const key = keyNow();
  if (profileId === null || key === null) return false;
  if (cache === null || cacheKey !== key) {
    cache = new Set();
    cacheKey = key;
  }
  const estaba = cache.has(pokemonId);
  if (estaba) cache.delete(pokemonId);
  else cache.add(pokemonId);
  announce();
  try {
    if (estaba) await capturesApi.remove(profileId, currentScope(), pokemonId);
    else await capturesApi.add(profileId, currentScope(), pokemonId);
    return !estaba;
  } catch {
    if (cache && cacheKey === key) {
      if (estaba) cache.add(pokemonId);
      else cache.delete(pokemonId);
    }
    announce();
    throw new Error("captures.toggleError");
  }
}

/** Se repinta cuando cambian las capturas, el perfil o el juego activo. */
export function useCaptures() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const recargar = () => {
      void loadCaptures();
      bump();
    };
    window.addEventListener(CAPTURES_EVENT, bump);
    window.addEventListener(ACTIVE_PROFILE_EVENT, recargar);
    window.addEventListener(ACTIVE_SESSION_EVENT, recargar);
    window.addEventListener(ACTIVE_CHAMPIONS_EVENT, recargar);
    void loadCaptures();
    return () => {
      window.removeEventListener(CAPTURES_EVENT, bump);
      window.removeEventListener(ACTIVE_PROFILE_EVENT, recargar);
      window.removeEventListener(ACTIVE_SESSION_EVENT, recargar);
      window.removeEventListener(ACTIVE_CHAMPIONS_EVENT, recargar);
    };
  }, []);
  const toggle = useCallback((pokemonId: number) => toggleCaptured(pokemonId), []);
  return {
    enabled: getActiveProfileId() !== null,
    ready: cache !== null && cacheKey === keyNow(),
    isCaptured,
    count: capturedCount(),
    toggle,
  };
}
