import type { CSSProperties } from "react";
import { PokeType } from "../types";
import { readableInk } from "../lib/theme";
import { useI18n } from "../i18n";

export function TypeBadge({ type, size = "md" }: { type: PokeType; size?: "sm" | "md" | "lg" }) {
  const { lang } = useI18n();
  const label = lang === "en" ? type.name_en : type.name_es;
  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };
  // `readableInk` (8.2): el texto era `#0A1425` fijo y con siniestro, fantasma,
  // dragón, lucha y veneno se quedaba entre 2.79:1 y 3.28:1, por debajo de AA.
  // Esos cinco pasan a texto blanco y suben a 5.6-6.6:1; los otros trece siguen
  // en oscuro, que es donde contrastan.
  //
  // `color-chip` y `--chip-color` son para el alto contraste (8.1): ahí el color
  // del tipo pasa de fondo a marco. Ver `.high-contrast .color-chip` en index.css.
  return (
    <span
      className={`color-chip inline-flex items-center gap-1.5 rounded-full font-display font-semibold tracking-wide uppercase shadow-card ${sizes[size]}`}
      style={
        {
          backgroundColor: type.color,
          color: readableInk(type.color),
          "--chip-color": type.color,
        } as CSSProperties
      }
    >
      {label}
    </span>
  );
}
