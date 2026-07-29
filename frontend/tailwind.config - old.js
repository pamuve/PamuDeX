/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: "#0A1425",     // color principal
        panel: "#132238",    // paneles
        hover: "#1C3350",    // hover
        ink: "#F5F7FA",      // texto
        "ink-soft": "#A9BDD2", // texto secundario
      },
      fontFamily: {
        // Pilas de fuentes de sistema (sin CDNs externos) para no romper el uso offline de la PWA.
        display: ["'Segoe UI'", "system-ui", "-apple-system", "sans-serif"],
        body: ["system-ui", "-apple-system", "'Segoe UI'", "sans-serif"],
        mono: ["'SFMono-Regular'", "'JetBrains Mono'", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 4px 20px -4px rgba(0,0,0,0.45)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        fadein: { "0%": { opacity: 0, transform: "translateY(4px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
      },
      animation: {
        fadein: "fadein 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
