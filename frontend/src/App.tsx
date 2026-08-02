import { Routes, Route } from "react-router-dom";
import { TopBar } from "./components/TopBar";
import { Home } from "./pages/Home";
import { PokemonDetail } from "./pages/PokemonDetail";
import { TypeDetail } from "./pages/TypeDetail";
import { MoveDetail } from "./pages/MoveDetail";
import { AbilityDetail } from "./pages/AbilityDetail";
import { TeamBuilder } from "./pages/TeamBuilder";
import Sessions from "./pages/Sessions";
import Editor from "./pages/Editor";
import EditorPokemon from "./pages/EditorPokemon";
import ImportExport from "./pages/ImportExport";
import { useSessionTheme } from "./lib/theme";
import { useActiveSession } from "./lib/session";

export default function App() {
  useSessionTheme();                    // aplica el tema de la sesión activa
  const [sessionId] = useActiveSession();

  // `lib/api.ts` añade ?session=<id> a cada petición. Al cambiar de sesión hay
  // que volver a pedir los datos: la key remonta las páginas y se refrescan solas.
  return (
    <div className="min-h-full bg-base">
      <TopBar />
      <Routes key={sessionId ?? "global"}>
        <Route path="/" element={<Home />} />
        <Route path="/pokemon/:id" element={<PokemonDetail />} />
        <Route path="/tipo/:id" element={<TypeDetail />} />
        <Route path="/movimiento/:id" element={<MoveDetail />} />
        <Route path="/habilidad/:id" element={<AbilityDetail />} />
        <Route path="/equipo" element={<TeamBuilder />} />
        <Route path="/sesiones" element={<Sessions />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/editor/pokemon" element={<EditorPokemon />} />
        <Route path="/datos" element={<ImportExport />} />
      </Routes>
    </div>
  );
}
