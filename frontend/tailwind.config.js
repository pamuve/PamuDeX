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
  darkMode: "class",
  theme: {
    extend: {
      /*
       * `base` NO va aquí — DECISIÓN DE LA 8.1, y arregla un fallo que llevaba
       * suelto desde la Fase 1.
       *
       * `extend.colors` genera la familia entera de utilidades, así que un
       * color llamado `base` producía un segundo `.text-base { color:
       * var(--color-base) }` que se emitía DESPUÉS del `.text-base` de tamaño
       * de fuente de Tailwind y lo pisaba. Resultado: cualquier elemento con
       * `text-base` pintaba el texto del color del FONDO y quedaba invisible
       * (`sm:text-base` en /perfiles, entre otros).
       *
       * Declarándolo solo en las utilidades donde se usa de verdad, `bg-base` y
       * `border-base` siguen funcionando igual y `text-base` vuelve a ser lo
       * que todo el mundo espera: el tamaño de letra.
       */
      colors: {
        panel: "var(--color-panel)",
        hover: "var(--color-hover)",
        ink: {
          DEFAULT: "var(--color-ink)",
          soft: "var(--color-ink-soft)",
        },
        accent: "var(--color-accent)",
      },
      backgroundColor: {
        base: "var(--color-base)",
      },
      borderColor: {
        base: "var(--color-base)",
      },
      fontFamily: {
        // Pilas de fuentes de sistema (sin CDNs externos) para no romper el uso offline de la PWA.
        display: ["'Segoe UI'", "system-ui", "-apple-system", "sans-serif"],
        body: ["system-ui", "-apple-system", "'Segoe UI'", "sans-serif"],
        mono: ["'SFMono-Regular'", "'JetBrains Mono'", "Consolas", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
        /*xl2: "1rem",*/
      },
      boxShadow: {
        card: "0 4px 20px -4px rgba(0,0,0,0.45)",
        /*card: "0 2px 10px rgba(0, 0, 0, 0.35)",*/
      },
      keyframes: {
        fadein: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        /* fadein: { "0%": { opacity: 0, transform: "translateY(4px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
 */
      },
      animation: {
        fadein: "fadein 180ms ease-out",
        /* fadein: "fadein 0.25s ease-out", */
      },
    },
  },
  plugins: [],
};
