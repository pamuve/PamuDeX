import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import es from "./es.json";
import en from "./en.json";
import { profilesApi } from "../lib/apiSession";
import {
  getActiveProfile,
  syncActiveProfile,
  ACTIVE_PROFILE_EVENT,
} from "../lib/profile";

// Añadir un idioma nuevo = añadir su JSON aquí. Nada más del código cambia.
const DICTS: Record<string, Record<string, string>> = { es, en };
export const AVAILABLE_LANGS = [
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "en", flag: "🇬🇧", label: "English" },
];

export const LANG_KEY = "pamudex_lang";

/**
 * El idioma es del perfil, no del navegador (Tarea 5.4).
 *
 * DÓNDE SE GUARDA Y POR QUÉ AHÍ
 * -----------------------------
 * En `profiles.language`, la columna que existe desde la 5.1, y NO en la tabla
 * `settings`. El perfil activo se cachea entero en localStorage, así que su
 * idioma está disponible en el primer render y sin conexión; con `settings`
 * haría falta una petición antes de saber en qué idioma pintar la interfaz, y
 * tener el dato en dos sitios solo podría acabar en incoherencias.
 *
 * `localStorage.pamudex_lang` se mantiene como RESPALDO: es lo que se usa antes
 * de elegir perfil y si el almacenamiento del perfil no está disponible.
 */
function langInicial(): string {
  const profile = getActiveProfile();
  if (profile && DICTS[profile.language]) return profile.language;
  try {
    const guardado = localStorage.getItem(LANG_KEY);
    if (guardado && DICTS[guardado]) return guardado;
  } catch {
    /* almacenamiento bloqueado */
  }
  return "es";
}

type TParams = Record<string, string | number>;
type Ctx = { lang: string; setLang: (l: string) => void; t: (key: string, params?: TParams) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState(langInicial);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* modo privado: la app sigue funcionando, solo no recuerda el idioma */
    }
    document.documentElement.lang = lang;

    // Y si hay perfil activo, se guarda en él. La comparación evita escribir en
    // el arranque y evita un bucle cuando el cambio viene del propio perfil.
    const profile = getActiveProfile();
    if (!profile || profile.language === lang) return;

    profilesApi
      .update(profile.id, { language: lang })
      .then(syncActiveProfile) // refresca la copia cacheada del perfil
      .catch(() => {
        // Sin conexión el idioma se queda en localStorage y se reintentará al
        // volver a cambiarlo. No se avisa: sería ruido para algo reversible.
      });
  }, [lang]);

  // Cambiar de perfil cambia de idioma. Cierra el círculo: el criterio de
  // aceptación de la 5.4 es que el idioma del perfil A no toque al del B.
  useEffect(() => {
    const sync = () => {
      const profile = getActiveProfile();
      if (profile && DICTS[profile.language]) setLang(profile.language);
    };
    window.addEventListener(ACTIVE_PROFILE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ACTIVE_PROFILE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const t = useMemo(() => {
    const dict = DICTS[lang] || DICTS.es;
    return (key: string, params?: TParams) => {
      let str = dict[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          str = str.replace(new RegExp(`{{${k}}}`, "g"), String(v));
        });
      }
      return str;
    };
  }, [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n debe usarse dentro de <I18nProvider>");
  return ctx;
}
