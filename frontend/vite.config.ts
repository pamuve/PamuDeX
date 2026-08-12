import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "PamuDeX",
        short_name: "PamuDeX",
        description: "Consulta de tipos, combates y equipos Pokémon — offline y autoalojada.",
        theme_color: "#0A1425",
        background_color: "#0A1425",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cachea el shell de la app; los datos de la API se cachean aparte (ver src/lib/api.ts)
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        // El orden importa: gana la primera regla que encaje.
        runtimeCaching: [
          {
            // Datos que el usuario MODIFICA desde la propia app: perfiles,
            // favoritos, sesiones, historial y ajustes. Con StaleWhileRevalidate
            // se veían con un navegación de retraso (marcabas un favorito y no
            // salía en /favoritos hasta la siguiente carga), porque el SW
            // respondía con la copia anterior mientras revalidaba por detrás.
            //
            // NetworkFirst da el dato fresco cuando hay red y cae en la caché
            // cuando no la hay, así que no se pierde el modo offline.
            //
            // Si añades un endpoint que el usuario pueda modificar, va AQUÍ.
            urlPattern: /\/api\/(favorites|profiles|sessions|history|settings|champions)\b/,
            handler: "NetworkFirst",
            options: {
              cacheName: "pamudex-user-cache",
              networkTimeoutSeconds: 3,
            },
          },
          {
            // El dataset (tipos, Pokémon, movimientos, habilidades, búsqueda)
            // solo cambia al reconstruir la imagen, así que aquí sí interesa
            // responder al instante desde la caché.
            urlPattern: /\/api\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "pamudex-api-cache" },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
