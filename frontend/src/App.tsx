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
import { useSessionTheme } from "./lib/theme";
  

export default function App() {
  useSessionTheme();          // aplica el tema de la sesión activa
  return (
    <div className="min-h-full bg-base">
      <TopBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pokemon/:id" element={<PokemonDetail />} />
        <Route path="/tipo/:id" element={<TypeDetail />} />
        <Route path="/movimiento/:id" element={<MoveDetail />} />
        <Route path="/habilidad/:id" element={<AbilityDetail />} />
        <Route path="/equipo" element={<TeamBuilder />} />
        <Route path="/sesiones" element={<Sessions />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/editor/pokemon" element={<EditorPokemon />} />
        </Routes>
    </div>
  );
}
