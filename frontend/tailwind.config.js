/**
 * Un color del tema que admite opacidad (`bg-base/90`, `ring-ink-soft/40`).
 *
 * Tailwind 3 no sabe aplicar opacidad a un `var(--color-*)` a secas: en lugar
 * de avisar, NO GENERA la clase. Así se habían quedado sin efecto una treintena
 * de usos — la barra superior «semitransparente» era transparente del todo y
 * los anillos de foco `ring-ink-soft/40` no existían. Con `color-mix` la
 * variable sigue mandando (tema de sesión, perfil, alto contraste) y la
 * opacidad se aplica encima. Sin modificador, `<alpha-value>` vale 1 y sale el
 * color tal cual.
 */
const tema = (nombre) =>
  `color-mix(in srgb, var(--color-${nombre}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  future: {
    // `hover:` solo donde hay un puntero que pueda flotar. En táctil, el hover
    // se quedaba «pegado» tras tocar una tarjeta hasta tocar en otro sitio.
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      /*
       * Los colores del tema son `var(--color-*)` (`src/theme-vars.css`) para
       * que la sesión de ROM Hack, el perfil y el alto contraste puedan
       * pisarlos. Nunca hex fijos aquí.
       *
       * `base` NO va en `colors` (8.1): generaría un `.text-base { color }` que
       * pisaba al `text-base` de tamaño de letra y pintaba el texto del color
       * del fondo. Se declara solo en las utilidades donde se usa.
       *
       * Los cuatro de estado (éxito, peligro, aviso, favorito) van en canales
       * RGB para que admitan opacidad (`bg-danger/15`). No son parte del tema
       * de sesión: significan lo mismo en todos los ROM Hacks.
       */
      colors: {
        panel: tema("panel"),
        hover: tema("hover"),
        ink: {
          DEFAULT: tema("ink"),
          soft: tema("ink-soft"),
        },
        accent: tema("accent"),
        success: "rgb(var(--color-success-rgb) / <alpha-value>)",
        danger: "rgb(var(--color-danger-rgb) / <alpha-value>)",
        warning: "rgb(var(--color-warning-rgb) / <alpha-value>)",
        favorite: "rgb(var(--color-favorite-rgb) / <alpha-value>)",
      },
      backgroundColor: {
        base: tema("base"),
      },
      borderColor: {
        base: tema("base"),
      },
      fontFamily: {
        // Pilas de fuentes de sistema (sin CDNs externos) para no romper el uso offline de la PWA.
        display: ["'Segoe UI'", "system-ui", "-apple-system", "sans-serif"],
        body: ["system-ui", "-apple-system", "'Segoe UI'", "sans-serif"],
        mono: ["'SFMono-Regular'", "'JetBrains Mono'", "Consolas", "monospace"],
      },
      borderRadius: {
        // Contenedores. Lo de dentro (botones, filas, chips) va en `rounded-lg`.
        xl2: "1rem",
      },
      boxShadow: {
        // Tarjetas: la separación la da el color del panel; la sombra es solo un
        // filo de luz arriba y un apoyo mínimo abajo.
        card: "inset 0 1px 0 0 rgb(255 255 255 / 0.04), 0 1px 3px rgb(2 6 16 / 0.35)",
        // Lo que flota por encima del contenido: menús, listas, diálogos, avisos.
        float: "0 16px 40px -12px rgb(2 6 16 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.05)",
      },
      keyframes: {
        fadein: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        // Entrada con el muelle sin rebote: rápida al principio y asentándose
        // sin frenazo, en vez de una curva fija que termina de golpe.
        // Sin `fill-mode`: al terminar no debe quedar un `transform` puesto, o
        // cada tarjeta abriría su propio contexto de apilado y los desplegables
        // de dentro (etiquetas de cambios) quedarían bajo la tarjeta siguiente.
        fadein: "fadein 420ms var(--ease-spring)",
      },
    },
  },
  plugins: [],
};
