/**
 * PamuDeX — Tarea 3.5
 * tailwind.config.js con la paleta conectada a variables CSS.
 *
 * OJO: este archivo SUSTITUYE al de la Fase 1. Si el tuyo tiene algo más
 * (plugins, fuentes, breakpoints propios), cópialo dentro en lugar de
 * reemplazarlo a ciegas. Lo único imprescindible de la tarea 3.5 es que los
 * colores dejen de ser hex fijos y pasen a ser `var(--color-*)`.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "var(--color-base)",
        panel: "var(--color-panel)",
        hover: "var(--color-hover)",
        ink: {
          DEFAULT: "var(--color-ink)",
          soft: "var(--color-ink-soft)",
        },
        accent: "var(--color-accent)",
      },
      borderRadius: {
        xl2: "1rem",
      },
      boxShadow: {
        card: "0 2px 10px rgba(0, 0, 0, 0.35)",
      },
      keyframes: {
        fadein: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadein: "fadein 180ms ease-out",
      },
    },
  },
  plugins: [],
};
