import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "../lib/api";
import { SearchResults } from "../types";
import { useI18n } from "../i18n";

export function SearchBar() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const handle = setTimeout(() => {
      api.search(q).then((r) => {
        setResults(r);
        setOpen(true);
      });
    }, 150);
    return () => clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const hasResults =
    results && (results.pokemon.length || results.types.length || results.moves.length || results.abilities.length);

  function go(path: string) {
    navigate(path);
    setOpen(false);
    setQ("");
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xl mx-auto">
      <div className="flex items-center gap-2 bg-panel rounded-xl2 px-4 py-3 shadow-card border border-hover focus-within:border-[#6890F0] transition-colors">
        <Search size={18} className="text-ink-soft" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder={t("search.placeholder")}
          className="bg-transparent outline-none w-full text-ink placeholder:text-ink-soft/70"
        />
      </div>

      {open && (
        <div className="absolute mt-2 w-full bg-panel border border-hover rounded-xl2 shadow-card max-h-96 overflow-auto z-20 animate-fadein">
          {!hasResults && <div className="px-4 py-4 text-sm text-ink-soft">{t("empty.results")}</div>}

          {results?.pokemon.map((p) => (
            <button
              key={`p-${p.id}`}
              onClick={() => go(`/pokemon/${p.id}`)}
              className="w-full text-left px-4 py-2.5 hover:bg-hover flex items-center justify-between"
            >
              <span className="text-ink">{p.name_es}</span>
              <span className="text-ink-soft text-xs font-mono">#{String(p.dex).padStart(3, "0")}</span>
            </button>
          ))}
          {results?.types.map((tp) => (
            <button key={`t-${tp.id}`} onClick={() => go(`/tipo/${tp.id}`)} className="w-full text-left px-4 py-2.5 hover:bg-hover flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tp.color }} />
              <span className="text-ink">{tp.name_es}</span>
            </button>
          ))}
          {results?.moves.map((m) => (
            <button key={`m-${m.id}`} onClick={() => go(`/movimiento/${m.id}`)} className="w-full text-left px-4 py-2.5 hover:bg-hover flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="text-ink">{m.name_es}</span>
            </button>
          ))}
          {results?.abilities.map((a) => (
            <button key={`a-${a.id}`} onClick={() => go(`/habilidad/${a.id}`)} className="w-full text-left px-4 py-2.5 hover:bg-hover">
              <span className="text-ink">{a.name_es}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
