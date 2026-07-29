/**
 * PamuDeX — Tarea 3.3
 * Piezas compartidas por los formularios del editor visual.
 */

import type { ReactNode } from "react";

/** Color de acento para señalar campos modificados. Definido en theme-vars.css. */
export const ACCENT = "var(--color-accent, #7FB4E8)";

export const inputClass =
  "w-full rounded-lg bg-base px-3 py-2 text-ink placeholder:text-ink-soft/60 " +
  "border border-hover outline-none focus:border-ink-soft focus:ring-2 focus:ring-ink-soft/30";

export const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink-soft " +
  "hover:bg-hover hover:text-ink focus:outline-none focus:ring-2 focus:ring-ink-soft/40 " +
  "disabled:opacity-40 transition-colors";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-hover px-4 py-2 text-sm " +
  "font-medium text-ink hover:brightness-125 focus:outline-none focus:ring-2 " +
  "focus:ring-ink-soft/40 disabled:opacity-40 transition";

interface FieldProps {
  label: string;
  htmlFor?: string;
  /** true = el valor difiere del dato global */
  modified?: boolean;
  modifiedLabel?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  modified = false,
  modifiedLabel = "modificado",
  hint,
  error,
  children,
  className = "",
}: FieldProps) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-ink-soft"
      >
        {label}
        {modified && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] normal-case tracking-normal"
            style={{ color: ACCENT, border: `1px solid ${ACCENT}` }}
          >
            {modifiedLabel}
          </span>
        )}
      </label>

      <div style={modified ? { boxShadow: `inset 0 0 0 1px ${ACCENT}`, borderRadius: "0.5rem" } : undefined}>
        {children}
      </div>

      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs" role="alert" style={{ color: "#F08A8A" }}>
          {error}
        </p>
      )}
    </div>
  );
}
