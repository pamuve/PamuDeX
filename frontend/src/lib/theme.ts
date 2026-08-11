/**
 * PamuDeX — Tarea 3.5
 * Tema (colores) por sesión, mediante variables CSS.
 *
 * Regla innegociable del proyecto: nunca negro puro. En pantallas OLED el
 * #000000 provoca "black smearing" al mover contenido, y el salto de brillo
 * entre píxel apagado y encendido cansa la vista.
 */

import { useEffect } from "react";
import { sessionsApi } from "./apiSession";
import { useActiveSession } from "./session";
import { useActiveProfile } from "./profile";

export interface ThemeColors {
  base: string;
  panel: string;
  hover: string;
  ink: string;
  inkSoft: string;
  accent?: string;
}

export const DEFAULT_THEME: ThemeColors = {
  base: "#0A1425",
  panel: "#132238",
  hover: "#1C3350",
  ink: "#F5F7FA",
  inkSoft: "#A9BDD2",
  accent: "#7FB4E8",
};

export const THEME_VARS: Record<keyof ThemeColors, string> = {
  base: "--color-base",
  panel: "--color-panel",
  hover: "--color-hover",
  ink: "--color-ink",
  inkSoft: "--color-ink-soft",
  accent: "--color-accent",
};

export const THEME_KEYS: (keyof ThemeColors)[] = ["base", "panel", "hover", "ink", "inkSoft"];

const HEX = /^#[0-9a-fA-F]{6}$/;

function channels(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

export function isValidHex(value: string): boolean {
  return HEX.test(value);
}

/** #000000 exacto: prohibido. */
export function isPureBlack(value: string): boolean {
  if (!HEX.test(value)) return false;
  return channels(value).every((c) => c === 0);
}

/** Casi negro: se permite, pero se avisa. */
export function isNearBlack(value: string): boolean {
  if (!HEX.test(value)) return false;
  return channels(value).every((c) => c < 10) && !isPureBlack(value);
}

export interface ThemeValidation {
  errors: Partial<Record<keyof ThemeColors, "hex" | "black">>;
  warnings: Partial<Record<keyof ThemeColors, "nearBlack">>;
  ok: boolean;
}

export function validateTheme(colors: Partial<ThemeColors>): ThemeValidation {
  const errors: ThemeValidation["errors"] = {};
  const warnings: ThemeValidation["warnings"] = {};

  for (const key of Object.keys(colors) as (keyof ThemeColors)[]) {
    const value = colors[key];
    if (!value) continue;
    if (!isValidHex(value)) errors[key] = "hex";
    else if (isPureBlack(value)) errors[key] = "black";
    else if (isNearBlack(value)) warnings[key] = "nearBlack";
  }

  return { errors, warnings, ok: Object.keys(errors).length === 0 };
}

/**
 * Escribe las variables en <html>. Pasar null restaura la paleta original.
 * Los colores inválidos o negro puro se ignoran en silencio (ya se avisa en la UI).
 */
export function applyTheme(colors: Partial<ThemeColors> | null): void {
  const root = document.documentElement;
  const effective: ThemeColors = { ...DEFAULT_THEME, ...(colors || {}) };

  for (const key of Object.keys(THEME_VARS) as (keyof ThemeColors)[]) {
    const value = effective[key];
    const safe = value && isValidHex(value) && !isPureBlack(value) ? value : DEFAULT_THEME[key];
    if (safe) root.style.setProperty(THEME_VARS[key], safe);
  }
}

/** Lee el tema guardado en el data_json de una sesión. */
export function readTheme(data: unknown): ThemeColors | null {
  if (!data || typeof data !== "object") return null;
  const theme = (data as Record<string, unknown>).theme;
  if (!theme || typeof theme !== "object") return null;
  return { ...DEFAULT_THEME, ...(theme as Partial<ThemeColors>) };
}

/* ------------------------------------------------------------------ */
/* Temas de perfil (Tarea 5.4)                                        */
/* ------------------------------------------------------------------ */

/**
 * Paletas con nombre que puede elegir un perfil (`profiles.theme`, columna que
 * existe desde la 5.1 y que hasta ahora nadie leía).
 *
 * Son paletas CERRADAS, no colores libres: el editor de colores libre es del
 * tema de sesión (Fase 3.5), que sirve para que un ROM Hack tenga su identidad.
 * Lo del perfil es una preferencia personal, y con un catálogo revisado se
 * garantiza que ninguna combinación deja texto ilegible ni cae en negro puro.
 */
export const PROFILE_THEMES: Record<string, ThemeColors> = {
  oled: DEFAULT_THEME,
  abismo: {
    base: "#071A1C",
    panel: "#0F2A2D",
    hover: "#17393E",
    ink: "#F2F8F8",
    inkSoft: "#9FC2C4",
    accent: "#57C7C7",
  },
  bosque: {
    base: "#0A1A12",
    panel: "#12291D",
    hover: "#1B3B2A",
    ink: "#F3F9F4",
    inkSoft: "#A5C6B0",
    accent: "#78C850",
  },
  brasa: {
    base: "#1A0E0A",
    panel: "#2B1811",
    hover: "#3D231A",
    ink: "#FBF4F0",
    inkSoft: "#D2B0A0",
    accent: "#F08030",
  },
  ciruela: {
    base: "#150A1E",
    panel: "#24122F",
    hover: "#331B42",
    ink: "#F8F3FB",
    inkSoft: "#C0A9D2",
    accent: "#A040A0",
  },
};

/** Ids del catálogo, en el orden en que los pinta la pantalla de ajustes. */
export const PROFILE_THEME_IDS = Object.keys(PROFILE_THEMES);

/** Paleta de un perfil. Un nombre desconocido cae en la de siempre. */
export function profileTheme(name: string | null | undefined): ThemeColors {
  if (name && PROFILE_THEMES[name]) return PROFILE_THEMES[name];
  return DEFAULT_THEME;
}

/**
 * Aplica el tema efectivo. Se llama una sola vez, en App.tsx.
 *
 * PRECEDENCIA: LA SESIÓN PISA AL PERFIL
 * -------------------------------------
 * Decisión de la 5.4, porque los dos escriben en las mismas variables
 * `--color-*`. Una sesión es un ROM Hack concreto y su identidad visual manda
 * mientras esté abierta; el tema del perfil es la preferencia de fondo, la que
 * se ve en el modo estándar. Si la sesión activa no define tema propio, se cae
 * al del perfil en vez de a la paleta por defecto.
 */
export function useAppTheme(): void {
  const [sessionId] = useActiveSession();
  const [profile] = useActiveProfile();
  const nombreTemaPerfil = profile ? profile.theme : null;

  useEffect(() => {
    let cancelled = false;
    const delPerfil = profileTheme(nombreTemaPerfil);

    if (sessionId === null) {
      applyTheme(delPerfil);
      return;
    }

    sessionsApi
      .get(sessionId)
      .then((session) => {
        if (cancelled) return;
        applyTheme(readTheme(session.data) || delPerfil);
      })
      .catch(() => {
        // Sin conexión no se sabe si la sesión tenía tema: se usa el del perfil,
        // que siempre está disponible.
        if (!cancelled) applyTheme(delPerfil);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, nombreTemaPerfil]);
}
