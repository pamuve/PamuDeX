/**
 * PamuDeX — Tarea 3.4
 * Matriz 18x18 atacante -> defensor. Cada celda cicla entre
 * x0 / x0.25 / x0.5 / x1 / x2 / x4 al pulsarla.
 *
 * En móvil: scroll horizontal con la primera columna y la cabecera fijas.
 */

import { RotateCcw } from "lucide-react";
import { MULTIPLIERS, typeName, type TypeMeta } from "../../lib/apiSession";
import { btnGhost } from "./FormField";

interface Props {
  types: TypeMeta[];
  chart: Record<string, Record<string, number>>;
  overrides: Record<string, Record<string, number>>;
  lang?: string;
  saving: boolean;
  t: (key: string, params?: Record<string, string>) => string;
  onChange: (attacker: string, defender: string, multiplier: number) => void;
  onResetAll: () => void;
}

/** Colores del valor, legibles sobre fondo OLED. */
const CELL_STYLE: Record<string, { bg: string; fg: string; text: string }> = {
  "4": { bg: "#2FA36B", fg: "#04140C", text: "4" },
  "2": { bg: "#1F6B4A", fg: "#EAF7F0", text: "2" },
  "1": { bg: "#182B45", fg: "#A9BDD2", text: "1" },
  "0.5": { bg: "#7A3A3A", fg: "#FBEDED", text: "½" },
  "0.25": { bg: "#4E2323", fg: "#F3D6D6", text: "¼" },
  "0": { bg: "#101C2E", fg: "#6C7F95", text: "0" },
};

function styleFor(multiplier: number) {
  return CELL_STYLE[String(multiplier)] || CELL_STYLE["1"];
}

function abbreviate(label: string) {
  return label.slice(0, 3).toUpperCase();
}

export default function RelationsMatrix({
  types,
  chart,
  overrides,
  lang,
  saving,
  t,
  onChange,
  onResetAll,
}: Props) {
  function cycle(attacker: string, defender: string) {
    const current = chart[attacker]?.[defender] ?? 1;
    const index = MULTIPLIERS.findIndex((m) => m === current);
    const next = MULTIPLIERS[(index + 1) % MULTIPLIERS.length];
    onChange(attacker, defender, next);
  }

  return (
    <div className="rounded-xl2 bg-panel p-3 shadow-card animate-fadein sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">{t("editor.relations.hint")}</p>
        <button type="button" className={btnGhost} onClick={onResetAll} disabled={saving}>
          <RotateCcw size={16} aria-hidden="true" />
          {t("editor.relations.resetAll")}
        </button>
      </div>

      {/* Leyenda */}
      <ul className="mb-3 flex flex-wrap gap-1.5">
        {[...MULTIPLIERS].reverse().map((multiplier) => {
          const style = styleFor(multiplier);
          return (
            <li key={multiplier}
              className="rounded-lg px-2 py-1 text-[11px]"
              style={{ backgroundColor: style.bg, color: style.fg }}>
              {`x${multiplier}`}
            </li>
          );
        })}
      </ul>

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-hover">
        <table className="border-separate border-spacing-0 text-[11px]">
          <caption className="sr-only">{t("editor.relations.caption")}</caption>
          <thead>
            <tr>
              <th scope="col"
                className="sticky left-0 top-0 z-30 bg-base px-2 py-1 text-left text-ink-soft">
                {t("editor.relations.corner")}
              </th>
              {types.map((type) => (
                <th key={type.id} scope="col" title={typeName(type, lang)}
                  className="sticky top-0 z-20 bg-base px-1 py-1 font-medium text-ink-soft">
                  <span aria-hidden="true">{abbreviate(typeName(type, lang))}</span>
                  <span className="sr-only">{typeName(type, lang)}</span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {types.map((attacker) => (
              <tr key={attacker.id}>
                <th scope="row" title={typeName(attacker, lang)}
                  className="sticky left-0 z-10 whitespace-nowrap bg-base px-2 py-1 text-left font-medium"
                  style={{ color: attacker.color }}>
                  <span aria-hidden="true">{abbreviate(typeName(attacker, lang))}</span>
                  <span className="sr-only">{typeName(attacker, lang)}</span>
                </th>

                {types.map((defender) => {
                  const value = chart[attacker.id]?.[defender.id] ?? 1;
                  const style = styleFor(value);
                  const isOverridden =
                    overrides[attacker.id] !== undefined &&
                    overrides[attacker.id][defender.id] !== undefined;

                  return (
                    <td key={defender.id} className="p-0">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => cycle(attacker.id, defender.id)}
                        aria-label={t("editor.relations.cell", {
                          attacker: typeName(attacker, lang),
                          defender: typeName(defender, lang),
                          value: `x${value}`,
                        })}
                        className="h-9 w-9 border border-base font-medium transition hover:brightness-125 focus:outline-none focus:ring-2 focus:ring-ink-soft/60 disabled:opacity-50"
                        style={{
                          backgroundColor: style.bg,
                          color: style.fg,
                          boxShadow: isOverridden
                            ? "inset 0 0 0 2px var(--color-accent, #7FB4E8)"
                            : undefined,
                        }}
                      >
                        {style.text}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
