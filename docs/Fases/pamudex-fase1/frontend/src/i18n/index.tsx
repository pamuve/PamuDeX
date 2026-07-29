import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import es from "./es.json";
import en from "./en.json";

// Añadir un idioma nuevo = añadir su JSON aquí. Nada más del código cambia.
const DICTS: Record<string, Record<string, string>> = { es, en };
export const AVAILABLE_LANGS = [
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "en", flag: "🇬🇧", label: "English" },
];

type Ctx = { lang: string; setLang: (l: string) => void; t: (key: string) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState(() => localStorage.getItem("pamudex_lang") || "es");

  useEffect(() => {
    localStorage.setItem("pamudex_lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useMemo(() => {
    const dict = DICTS[lang] || DICTS.es;
    return (key: string) => dict[key] ?? key;
  }, [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n debe usarse dentro de <I18nProvider>");
  return ctx;
}
