import type { CSSProperties } from "react";
import { PokeType } from "../types";
import { useI18n } from "../i18n";

export function TypeBadge({ type, size = "md" }: { type: PokeType; size?: "sm" | "md" | "lg" }) {
  const { lang } = useI18n();
  const label = lang === "en" ? type.name_en : type.name_es;
  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };
  // `color-chip` y `--chip-color` son para el alto contraste (8.1): ahí el
  // color del tipo pasa de fondo a marco y el texto se vuelve blanco sobre
  // negro, porque los tipos apagados (siniestro, roca, lucha) no llegan a AAA
  // con texto oscuro encima. Ver `.high-contrast .color-chip` en index.css.
  return (
    <span
      className={`color-chip inline-flex items-center gap-1.5 rounded-full font-display font-semibold tracking-wide uppercase shadow-card ${sizes[size]}`}
      style={
        {
          backgroundColor: type.color,
          color: "#0A1425",
          "--chip-color": type.color,
        } as CSSProperties
      }
    >
      {label}
    </span>
  );
}
