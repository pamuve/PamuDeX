import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // `prompt` y no `autoUpdate` (Tarea 8.3): el aviso de «hay una versión
      // nueva» es el caso de uso de las notificaciones, y con `autoUpdate` el
      // service worker se cambia solo y no hay nada que avisar. Ahora la
      // actualización espera a que el usuario diga cuándo, que además evita
      // recargar la página en mitad de una edición del editor de ROM Hacks.
      registerType: "prompt",
      // El registro lo hace `lib/serviceWorker.ts` desde `main.tsx`, porque
      // necesita enterarse de cuándo queda una versión esperando. El script que
      // inyecta el plugin solo registra y no avisa de nada.
      injectRegister: null,
      includeAssets: [
        "favicon.ico",
        "icons/apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-512-maskable.png",
      ],
      manifest: {
        name: "PamuDeX — Pokédex para ROM Hacks",
        short_name: "PamuDeX",
        description:
          "Consulta de tipos, combates y equipos Pokémon — offline y autoalojada.",
        lang: "es",
        theme_color: "#0A1425",
        background_color: "#0A1425",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        categories: ["games", "utilities", "reference"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // El `maskable` es un archivo DISTINTO, no el mismo con otra etiqueta:
          // va a sangre y sin esquinas redondeadas, porque el sistema le aplica
          // su propia forma y las esquinas transparentes saldrían en negro.
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Cachea el shell de la app; los datos de la API se cachean aparte (ver src/lib/api.ts)
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        // Los 1025 sprites son PNG y `globPatterns` los cazaría a todos. Eso
        // metería 1025 entradas en el manifiesto del service worker y la
        // primera visita se bajaría 1,1 MB de sprites de golpe para enseñar
        // uno. Se quedan fuera del precache y se cachean por uso, abajo: el
        // mismo criterio que dejó las 2200 fichas fuera de IndexedDB en la 8.4.
        globIgnores: ["**/sprites/**"],
        // El orden importa: gana la primera regla que encaje.
        runtimeCaching: [
          {
            // Un sprite es inmutable: el archivo #25 será siempre Pikachu. Con
            // CacheFirst se pide una vez y de ahí en adelante sale de la caché
            // sin tocar la red, así que el Pokémon que ya has mirado se ve
            // offline. El tope de entradas evita que recorrer la Pokédex entera
            // deje 1,1 MB en el aparato de quien no lo necesita.
            urlPattern: /\/sprites\/.*\.png$/,
            handler: "CacheFirst",
            options: {
              cacheName: "pamudex-sprite-cache",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
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
