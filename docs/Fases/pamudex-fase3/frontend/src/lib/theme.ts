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

/**
 * Aplica automáticamente el tema de la sesión activa.
 * Se llama una sola vez, en App.tsx.
 */
export function useSessionTheme(): void {
  const [sessionId] = useActiveSession();

  useEffect(() => {
    let cancelled = false;

    if (sessionId === null) {
      applyTheme(null);
      return;
    }

    sessionsApi
      .get(sessionId)
      .then((session) => {
        if (cancelled) return;
        applyTheme(readTheme(session.data));
      })
      .catch(() => {
        if (!cancelled) applyTheme(null);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);
}
