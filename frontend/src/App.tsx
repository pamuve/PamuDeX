import { lazy, Suspense, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { TopBar } from "./components/TopBar";
import { BottomNav } from "./components/BottomNav";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { Home } from "./pages/Home";
import ProfileSelect from "./pages/ProfileSelect";
import Favorites from "./pages/Favorites";
import { useActiveProfile } from "./lib/profile";
import { PokemonDetail } from "./pages/PokemonDetail";
import { TypeDetail } from "./pages/TypeDetail";
import { MoveDetail } from "./pages/MoveDetail";
import { AbilityDetail } from "./pages/AbilityDetail";
import History from "./pages/History";
import { Loading, NotFound } from "./components/PageState";
import { useActiveChampions } from "./lib/champions";
import { useAppTheme } from "./lib/theme";
import { useActiveSession } from "./lib/session";
import { useProfileSettings } from "./lib/settings";
import { useI18n } from "./i18n";

/*
  Carga diferida de las páginas de trabajo (comparador, sesiones, editor,
  datos, ajustes y Champions). Son más de la mitad del código y quien abre la
  app para mirar una debilidad no las necesita. Siguen funcionando sin
  conexión: sus archivos van en el precache del Service Worker igual que el
  resto (`globPatterns` coge todo `.js`), solo se descargan aparte.
*/
const TeamBuilder = lazy(() => import("./pages/TeamBuilder").then((m) => ({ default: m.TeamBuilder })));
const Sessions = lazy(() => import("./pages/Sessions"));
const Editor = lazy(() => import("./pages/Editor"));
const EditorPokemon = lazy(() => import("./pages/EditorPokemon"));
const ImportExport = lazy(() => import("./pages/ImportExport"));
const Settings = lazy(() => import("./pages/Settings"));
const ChampionsRules = lazy(() => import("./pages/ChampionsRules"));
const ChampionsHome = lazy(() => import("./pages/ChampionsHome"));

export default function App() {
  useAppTheme();                        // tema efectivo: la sesión pisa al perfil
  useProfileSettings();                 // ajustes del perfil + su sesión de ROM Hack
  const [sessionId] = useActiveSession();
  const { champions } = useActiveChampions();
  const [profile] = useActiveProfile();
  const { pathname } = useLocation();
  const { t } = useI18n();
  const mainRef = useRef<HTMLElement>(null);
  const primeraRuta = useRef(true);

  // La pantalla de perfiles hace de puerta de entrada, como en Netflix: sin
  // barra superior, porque desde ella todavía no hay perfil con el que navegar.
  const isProfileGate = pathname === "/perfiles";

  /*
    Al cambiar de ruta, el foco vuelve al contenido (Tarea 8.2).
    En una SPA el navegador no recarga nada, así que sin esto el foco se queda
    en el enlace que se acaba de pulsar: el lector de pantalla no anuncia la
    página nueva y el siguiente tabulador sigue por la barra, no por el
    contenido. Se salta en el primer render, donde no hay navegación previa.
  */
  useEffect(() => {
    if (primeraRuta.current) {
      primeraRuta.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [pathname]);

  // `lib/api.ts` añade ?session=<id> o ?champions=<id> a cada petición. Al
  // cambiar de modo hay que volver a pedir los datos: la key remonta las páginas
  // y se refrescan solas. Los dos modos son excluyentes, así que una sola key
  // los cubre.
  const modeKey = champions ? `champions:${champions.id}` : `session:${sessionId ?? "global"}`;

  return (
    <div className="min-h-full bg-base">
      {/*
        Enlace «saltar al contenido» (Tarea 8.2). Es el primer elemento
        enfocable del documento y está oculto hasta que recibe el foco: sin él,
        quien navega con teclado se come los once enlaces de la barra en cada
        página. `sr-only` lo mantiene accesible para el lector de pantalla.
      */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2
                   focus:bg-panel focus:text-ink focus:rounded-lg focus:px-4 focus:py-2.5
                   focus:shadow-card focus:border focus:border-hover"
      >
        {t("a11y.skipToContent")}
      </a>

      {!isProfileGate && <TopBar />}

      {/*
        UN SOLO `<main>`, aquí y no en cada página (8.2). Antes solo seis de
        dieciséis páginas tenían el hito, así que el enlace de arriba no habría
        tenido a dónde saltar en las otras diez. Centralizarlo garantiza que
        haya exactamente uno por documento y que las páginas futuras lo hereden.
        `tabIndex={-1}` es lo que permite que reciba el foco al saltar.
      */}
      {/* Por debajo de `lg` la navegación va en una barra fija abajo: el
          relleno inferior evita que tape el final de cada página. */}
      <main
        id="contenido"
        ref={mainRef}
        tabIndex={-1}
        className={`outline-none ${
          isProfileGate ? "" : "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0"
        }`}
      >
        <Suspense fallback={<Loading />}>
        <Routes key={modeKey}>
          <Route path="/perfiles" element={<ProfileSelect />} />
          {/* Sin perfil activo, la portada lleva a elegir uno. */}
          <Route path="/" element={profile ? <Home /> : <Navigate to="/perfiles" replace />} />
          <Route path="/pokemon/:id" element={<PokemonDetail />} />
          <Route path="/tipo/:id" element={<TypeDetail />} />
          <Route path="/movimiento/:id" element={<MoveDetail />} />
          <Route path="/habilidad/:id" element={<AbilityDetail />} />
          <Route path="/favoritos" element={<Favorites />} />
          <Route path="/historial" element={<History />} />
          <Route path="/ajustes" element={<Settings />} />
          {/* La ruta con más segmentos va primero para que no la capture /champions. */}
          <Route path="/champions/reglas" element={<ChampionsRules />} />
          <Route path="/champions" element={<ChampionsHome />} />
          <Route path="/equipo" element={<TeamBuilder />} />
          <Route path="/sesiones" element={<Sessions />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/editor/pokemon" element={<EditorPokemon />} />
          <Route path="/datos" element={<ImportExport />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>

      {/* Fuera del `<main>`: no es contenido de la página, es un aviso de la
          app. Se pinta solo cuando hay una versión esperando (8.3). */}
      {!isProfileGate && <BottomNav />}
      <UpdatePrompt />
    </div>
  );
}
