/**
 * PamuDeX — Tarea 5.4
 * Ajustes del perfil activo.
 *
 * QUÉ VIVE AQUÍ Y QUÉ NO
 * ----------------------
 * El idioma y el tema NO: son columnas de `profiles` (`language`, `theme`), que
 * viajan dentro del perfil cacheado en localStorage y por tanto están
 * disponibles en el primer render y sin conexión, sin una petición de más.
 * `settings` guarda lo que no merece columna propia: por ahora qué sesión de
 * ROM Hack usa cada perfil y si registra o no su historial.
 *
 * MISMO PATRÓN QUE lib/favorites.ts: caché de módulo + eventos de `window`, no
 * un context. Así ninguna página necesita un provider nuevo en main.tsx.
 *
 * LA SESIÓN DE ROM HACK PASA A SER DE CADA PERFIL
 * -----------------------------------------------
 * Hasta la 5.3, `pamudex_active_session` era una única clave de localStorage
 * compartida por todos los perfiles: entrabas con otro perfil y seguías dentro
 * del ROM Hack del anterior. Ahora localStorage sigue siendo la fuente de
 * verdad inmediata (la lee `lib/api.ts` en cada petición, y tiene que ser
 * síncrona), y `settings.active_session` es la copia por perfil que se restaura
 * al cambiar de uno a otro.
 */

import { useCallback, useEffect, useState } from "react";
import { settingsApi, type ProfileSettings } from "./apiSession";
import { getActiveProfileId, ACTIVE_PROFILE_EVENT } from "./profile";
import { getActiveSessionId, setActiveSessionId, ACTIVE_SESSION_EVENT } from "./session";

export type { ProfileSettings };

export const SETTINGS_EVENT = "pamudex:settings";

/** Los mismos valores por defecto que declara `backend/routes/settings.js`. */
export const DEFAULT_SETTINGS: ProfileSettings = {
  active_session: "",
  history_enabled: "1",
};

/** Ajustes del perfil activo. null = todavía no se han cargado. */
let cache: ProfileSettings | null = null;
/** Perfil al que corresponde la caché, para detectar cambios de perfil. */
let cacheProfile: number | null = null;
let loading: Promise<ProfileSettings> | null = null;

/**
 * Primera carga de esta pestaña. Distingue "arrancar la app" de "cambiar de
 * perfil", y eso cambia qué hacer con la sesión de ROM Hack (ver más abajo).
 */
let primeraCarga = true;

/** Evita que restaurar la sesión de un perfil se vuelva a guardar como cambio. */
let aplicandoSesion = false;

function announce() {
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT));
}

/** Descarta la caché (al cambiar de perfil o al salir). */
export function resetSettings() {
  cache = null;
  cacheProfile = null;
  loading = null;
  announce();
}

/** Cambia la sesión activa sin que el cambio se reinterprete como del usuario. */
function aplicarSesion(id: number | null) {
  aplicandoSesion = true;
  try {
    setActiveSessionId(id);
  } finally {
    aplicandoSesion = false;
  }
}

/**
 * Sincroniza la sesión de ROM Hack con la preferencia del perfil.
 *
 * El caso raro es "el perfil no tiene preferencia guardada":
 *  - al arrancar la app, se ADOPTA la sesión que hubiera en localStorage. Sin
 *    esto, la primera vez que se ejecuta la 5.4 el usuario perdería la sesión
 *    que tenía abierta desde la Fase 3, que es su trabajo de ROM Hack.
 *  - al cambiar de perfil, se LIMPIA: entrar en un perfil que nunca eligió
 *    sesión debe enseñar el dataset global, no el ROM Hack del perfil anterior.
 */
function sincronizarSesion(settings: ProfileSettings, cambioDePerfil: boolean) {
  const guardada = Number.parseInt(settings.active_session, 10);
  const valida = Number.isInteger(guardada) && guardada > 0 ? guardada : null;
  const actual = getActiveSessionId();

  if (valida !== null) {
    if (valida !== actual) aplicarSesion(valida);
    return;
  }

  if (cambioDePerfil) {
    if (actual !== null) aplicarSesion(null);
  } else if (actual !== null) {
    guardarSesionActiva();
  }
}

/**
 * Carga los ajustes del perfil activo si hacen falta.
 * Varias llamadas simultáneas comparten la misma petición.
 */
export function loadSettings(cambioDePerfil = false): Promise<ProfileSettings> {
  const profileId = getActiveProfileId();

  if (profileId === null) {
    if (cache !== null || cacheProfile !== null) resetSettings();
    return Promise.resolve(DEFAULT_SETTINGS);
  }
  if (cache !== null && cacheProfile === profileId) return Promise.resolve(cache);
  if (loading && cacheProfile === profileId) return loading;

  const inicial = primeraCarga;
  primeraCarga = false;
  cacheProfile = profileId;

  loading = settingsApi
    .get(profileId)
    .then((res) => {
      // El perfil pudo cambiar mientras llegaba la respuesta.
      if (cacheProfile !== profileId) return cache || DEFAULT_SETTINGS;
      cache = { ...DEFAULT_SETTINGS, ...res.settings };
      sincronizarSesion(cache, cambioDePerfil && !inicial);
      announce();
      return cache;
    })
    .catch(() => {
      // Sin conexión se usan los valores por defecto en vez de romper: la app
      // es offline-first y estos ajustes son secundarios. No se toca la sesión
      // activa, que sigue viviendo en localStorage.
      if (cacheProfile === profileId) {
        cache = { ...DEFAULT_SETTINGS };
        announce();
      }
      return cache || DEFAULT_SETTINGS;
    })
    .finally(() => {
      loading = null;
    });

  return loading;
}

/** Ajustes ya cargados, o los valores por defecto si aún no lo están. */
export function getSettings(): ProfileSettings {
  return cache || DEFAULT_SETTINGS;
}

/** ¿Este perfil registra su historial? Sin ajustes cargados se asume que sí. */
export function isHistoryEnabled(): boolean {
  return getSettings().history_enabled !== "0";
}

/**
 * Guarda un ajuste. Optimista: cambia la caché al instante y revierte si el
 * servidor falla.
 */
export async function setSetting<K extends keyof ProfileSettings>(
  key: K,
  value: string
): Promise<void> {
  const profileId = getActiveProfileId();
  if (profileId === null) return;

  const anterior = getSettings();
  cache = { ...anterior, [key]: value };
  announce();

  try {
    const res = await settingsApi.update(profileId, { [key]: value });
    if (cacheProfile === profileId) {
      cache = { ...DEFAULT_SETTINGS, ...res.settings };
      announce();
    }
  } catch (err) {
    if (cacheProfile === profileId) {
      cache = anterior;
      announce();
    }
    throw err;
  }
}

/** Copia la sesión activa de localStorage en los ajustes del perfil. */
function guardarSesionActiva() {
  const profileId = getActiveProfileId();
  if (profileId === null || cacheProfile !== profileId || cache === null) return;

  const id = getActiveSessionId();
  const value = id === null ? "" : String(id);
  if (cache.active_session === value) return;

  cache = { ...cache, active_session: value };
  announce();
  // Silencioso a propósito: sin conexión la sesión sigue funcionando desde
  // localStorage, solo se pierde la memoria entre perfiles.
  settingsApi.update(profileId, { active_session: value }).catch(() => {});
}

/**
 * Mantiene los ajustes al día. Se llama UNA sola vez, en App.tsx.
 *
 * Escucha los dos eventos que importan:
 *  - cambio de perfil -> recargar ajustes y restaurar su sesión de ROM Hack.
 *  - cambio de sesión -> recordarla como la del perfil activo. Al colgarse del
 *    evento y no de la página de sesiones, funciona desde cualquier sitio que
 *    cambie la sesión, hoy y en el futuro.
 */
export function useProfileSettings(): void {
  useEffect(() => {
    loadSettings();

    const onProfile = () => {
      // syncActiveProfile() dispara este mismo evento al refrescar el perfil
      // (por ejemplo al cambiar el idioma). Solo interesa el cambio real de
      // perfil: si no, restaurar la sesión se dispararía sin motivo.
      if (getActiveProfileId() === cacheProfile) return;
      resetSettings();
      loadSettings(true);
    };
    const onSession = () => {
      if (!aplicandoSesion) guardarSesionActiva();
    };

    window.addEventListener(ACTIVE_PROFILE_EVENT, onProfile);
    window.addEventListener(ACTIVE_SESSION_EVENT, onSession);
    window.addEventListener("storage", onProfile);
    return () => {
      window.removeEventListener(ACTIVE_PROFILE_EVENT, onProfile);
      window.removeEventListener(ACTIVE_SESSION_EVENT, onSession);
      window.removeEventListener("storage", onProfile);
    };
  }, []);
}

/** Ajustes del perfil activo para la pantalla que los edita. */
export function useSettings() {
  const [settings, setSettings] = useState<ProfileSettings>(() => getSettings());
  const [ready, setReady] = useState(cache !== null);

  useEffect(() => {
    const sync = () => {
      setSettings(getSettings());
      setReady(cache !== null);
    };
    window.addEventListener(SETTINGS_EVENT, sync);
    loadSettings().then(sync);
    return () => window.removeEventListener(SETTINGS_EVENT, sync);
  }, []);

  const update = useCallback(
    (key: keyof ProfileSettings, value: string) => setSetting(key, value),
    []
  );

  return { ready, settings, update };
}
