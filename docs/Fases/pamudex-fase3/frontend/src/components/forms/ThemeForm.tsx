/**
 * PamuDeX — Tarea 3.5
 * Sección "Tema" del editor de sesión: cinco selectores de color con
 * previsualización en vivo y bloqueo del negro puro.
 */

import { useEffect, useState } from "react";
import { RotateCcw, Save, Loader2 } from "lucide-react";
import {
  DEFAULT_THEME,
  THEME_KEYS,
  applyTheme,
  isValidHex,
  validateTheme,
  type ThemeColors,
} from "../../lib/theme";
import { Field, inputClass, btnGhost, btnPrimary } from "./FormField";

interface Props {
  theme: Partial<ThemeColors> | null;
  saving: boolean;
  t: (key: string, params?: Record<string, string>) => string;
  onSave: (theme: ThemeColors) => void | Promise<void>;
  onReset: () => void | Promise<void>;
}

export default function ThemeForm({ theme, saving, t, onSave, onReset }: Props) {
  const [draft, setDraft] = useState<ThemeColors>({ ...DEFAULT_THEME, ...(theme || {}) });

  useEffect(() => {
    setDraft({ ...DEFAULT_THEME, ...(theme || {}) });
  }, [theme]);

  // Previsualización en vivo: se pinta mientras se toca, se revierte al salir.
  useEffect(() => {
    applyTheme(draft);
    return () => applyTheme(theme);
  }, [draft, theme]);

  const validation = validateTheme(draft);

  function set(key: keyof ThemeColors, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!validation.ok) return;
    onSave(draft);
  }

  function handleReset() {
    setDraft({ ...DEFAULT_THEME });
    onReset();
  }

  return (
    <div className="rounded-xl2 bg-panel p-4 shadow-card animate-fadein">
      <p className="mb-4 text-sm text-ink-soft">{t("theme.hint")}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {THEME_KEYS.map((key) => {
          const value = draft[key] || "";
          const error = validation.errors[key];
          const warning = validation.warnings[key];

          return (
            <Field
              key={key}
              label={t(`theme.colors.${key}`)}
              htmlFor={`theme-${key}`}
              error={error ? t(error === "black" ? "theme.error.black" : "theme.error.hex") : null}
              hint={warning ? t("theme.warning.nearBlack") : undefined}
            >
              <div className="flex items-center gap-3">
                <input
                  id={`theme-${key}`}
                  type="color"
                  value={isValidHex(value) ? value : DEFAULT_THEME[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-hover bg-base"
                />
                <input
                  aria-label={t(`theme.colors.${key}`)}
                  className={inputClass}
                  value={value}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            </Field>
          );
        })}
      </div>

      {/* Previsualización */}
      <div className="mt-5 rounded-xl2 border border-hover p-4" style={{ backgroundColor: draft.base }}>
        <div className="rounded-xl2 p-4" style={{ backgroundColor: draft.panel }}>
          <p className="font-medium" style={{ color: draft.ink }}>{t("theme.preview.title")}</p>
          <p className="mt-1 text-sm" style={{ color: draft.inkSoft }}>{t("theme.preview.body")}</p>
          <span className="mt-3 inline-block rounded-lg px-3 py-1.5 text-sm"
            style={{ backgroundColor: draft.hover, color: draft.ink }}>
            {t("theme.preview.button")}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={btnGhost} onClick={handleReset} disabled={saving}>
          <RotateCcw size={16} aria-hidden="true" />
          {t("theme.reset")}
        </button>
        <button type="button" className={btnPrimary} onClick={handleSubmit}
          disabled={saving || !validation.ok}>
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
          {t("editor.save")}
        </button>
      </div>
    </div>
  );
}
