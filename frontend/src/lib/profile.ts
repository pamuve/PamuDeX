/**
 * PamuDeX — Tarea 5.1
 * Perfil activo guardado en localStorage.
 *
 * POR QUÉ SE GUARDA EL PERFIL ENTERO Y NO SOLO SU id
 * --------------------------------------------------
 * `lib/session.ts` guarda únicamente el id de la sesión porque su nombre no se
 * pinta en ninguna pantalla crítica. Aquí es al revés: la TopBar muestra el
 * avatar, el nombre y el color en el primer render, y PamuDeX es offline-first.
 * Si solo guardásemos el id habría que pedirlo al servidor en cada arranque, y
 * sin conexión la barra saldría vacía. Con el objeto completo cacheado, la app
 * abre igual con o sin red.
 *
 * El precio es que la copia puede quedarse desfasada si el perfil se edita
 * desde otro dispositivo. Se compensa refrescándola: `/perfiles` reescribe la
 * copia del perfil activo cada vez que carga la lista del servidor.
 *
 * Igual que con las sesiones, toda la app debe pasar por aquí y no leer la
 * clave de localStorage por su cuenta.
 */

import { useCallback, useEffect, useState } from "react";

export const ACTIVE_PROFILE_KEY = "pamudex_active_profile";
export const ACTIVE_PROFILE_EVENT = "pamudex:active-profile";

export interface Profile {
  id: number;
  user_id: number | null;
  name: string;
  avatar: string | null;
  color: string | null;
  language: string;
  theme: string;
  /**
   * Si el perfil está protegido con PIN (Tarea 5.2). El backend nunca envía el
   * hash: solo este booleano, que es lo único que hace falta para el candado.
   */
  has_pin: boolean;
}

/** Longitud exacta del PIN, como en Netflix. Debe coincidir con lib/pin.js. */
export const PIN_LENGTH = 4;

/** Comprueba que lo leído de localStorage tiene la forma de un perfil. */
function isProfile(value: unknown): value is Profile {
  if (value === null || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === "number" && p.id > 0 && typeof p.name === "string";
}

/** Devuelve el perfil activo, o null si todavía no se ha elegido ninguno. */
export function getActiveProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isProfile(parsed) ? parsed : null;
  } catch {
    // JSON corrupto o almacenamiento bloqueado: se trata como "sin perfil"
    return null;
  }
}

/** Atajo para cuando solo hace falta el id (peticiones, comparaciones). */
export function getActiveProfileId(): number | null {
  const profile = getActiveProfile();
  return profile ? profile.id : null;
}

/** Cambia el perfil activo (null = ninguno, vuelve a la pantalla de perfiles). */
export function setActiveProfile(profile: Profile | null): void {
  try {
    if (profile === null) localStorage.removeItem(ACTIVE_PROFILE_KEY);
    else localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* modo privado / almacenamiento lleno: seguimos igualmente */
  }
  window.dispatchEvent(new CustomEvent(ACTIVE_PROFILE_EVENT, { detail: profile }));
}

/**
 * Refresca la copia cacheada solo si el perfil que llega es el activo.
 * La usa `/perfiles` tras cargar la lista y tras editar un perfil.
 */
export function syncActiveProfile(profile: Profile): void {
  const current = getActiveProfile();
  if (current && current.id === profile.id) setActiveProfile(profile);
}

/** Si el perfil activo ya no existe en el servidor, se deja de usar. */
export function forgetIfMissing(profiles: Profile[]): void {
  const current = getActiveProfile();
  if (current && !profiles.some((p) => p.id === current.id)) setActiveProfile(null);
}

/**
 * Hook para leer y escribir el perfil activo.
 * Se sincroniza entre componentes y entre pestañas del navegador.
 */
export function useActiveProfile(): [Profile | null, (p: Profile | null) => void] {
  const [profile, setProfile] = useState<Profile | null>(() => getActiveProfile());

  useEffect(() => {
    const sync = () => setProfile(getActiveProfile());
    window.addEventListener(ACTIVE_PROFILE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ACTIVE_PROFILE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const select = useCallback((p: Profile | null) => setActiveProfile(p), []);

  return [profile, select];
}

/** Inicial que se pinta en el avatar cuando el perfil no tiene emoji. */
export function profileInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? Array.from(trimmed)[0].toUpperCase() : "?";
}
