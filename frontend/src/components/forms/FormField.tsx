/**
 * PamuDeX — Tarea 3.3
 * Piezas compartidas por los formularios del editor visual.
 */

import type { ReactNode } from "react";

/** Color de acento para señalar campos modificados. Definido en theme-vars.css. */
export const ACCENT = "var(--color-accent, #7FB4E8)";

/** Campo de texto. 44px de alto mínimo, como cualquier objetivo táctil. */
export const inputClass =
  "w-full min-h-[2.75rem] rounded-lg bg-base px-3 py-2 text-ink placeholder:text-ink-soft/60 " +
  "border border-hover outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-colors";

/*
 * Los botones son las clases comunes de `index.css`. Se mantienen estos
 * nombres porque los importan los seis formularios y el panel de importación.
 * El foco lo pinta el `:focus-visible` global: antes cada botón lo quitaba con
 * `focus:outline-none` y lo cambiaba por un `ring-ink-soft/40` que Tailwind ni
 * siquiera generaba.
 */
export const btnGhost = "btn-ghost";
export const btnPrimary = "btn-primary";

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
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
