import { Routes, Route } from "react-router-dom";
import { TopBar } from "./components/TopBar";
import { Home } from "./pages/Home";
import { PokemonDetail } from "./pages/PokemonDetail";
import { TypeDetail } from "./pages/TypeDetail";
import { MoveDetail } from "./pages/MoveDetail";
import { AbilityDetail } from "./pages/AbilityDetail";

export default function App() {
  return (
    <div className="min-h-full bg-base">
      <TopBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pokemon/:id" element={<PokemonDetail />} />
        <Route path="/tipo/:id" element={<TypeDetail />} />
        <Route path="/movimiento/:id" element={<MoveDetail />} />
        <Route path="/habilidad/:id" element={<AbilityDetail />} />
      </Routes>
    </div>
  );
}