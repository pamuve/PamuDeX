import { useState } from "react";
import { X } from "lucide-react";
import { PokemonDetail, RivalSlot, MoveSummary } from "../types";
import { TypeBadge } from "./TypeBadge";
import { useI18n } from "../i18n";

function MoveMultiSelect({
  title,
  allMoves,
  selectedIds,
  disabledIds,
  onToggle,
}: {
  title: string;
  allMoves: MoveSummary[];
  selectedIds: number[];
  disabledIds: number[];
  onToggle: (id: number) => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = allMoves.filter((m) => m.name_es.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div>
      <div className="text-xs text-ink-soft mb-1">{title}</div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full bg-hover rounded-lg px-2 py-1.5 text-sm text-ink outline-none mb-2"
      />
      <div className="max-h-28 overflow-auto space-y-1 pr-1">
        {filtered.map((m) => {
          const selected = selectedIds.includes(m.id);
          const disabled = disabledIds.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => !disabled && onToggle(m.id)}
              disabled={disabled}
              className={`w-full flex items-center justify-between text-left px-2 py-1 rounded-lg text-sm transition-colors ${
                selected
                  ? "bg-[#1C3350] text-ink"
                  : disabled
                  ? "text-ink-soft/30 cursor-not-allowed"
                  : "text-ink-soft hover:bg-hover"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                {m.name_es}
              </span>
              {selected && <span className="text-xs">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RivalSlotCard({
  slot,
  pokemon,
  allMoves,
  onChange,
  onRemove,
}: {
  slot: RivalSlot;
  pokemon: PokemonDetail | null;
  allMoves: MoveSummary[];
  onChange: (updated: RivalSlot) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();

  if (!pokemon) {
    return <div className="bg-panel rounded-xl2 p-4 shadow-card animate-fadein text-ink-soft text-sm">Cargando...</div>;
  }

  const abilityOptions = [
    ...pokemon.abilities.map((a) => a.name_es),
    ...(pokemon.hidden_ability ? [pokemon.hidden_ability.name_es] : []),
  ];

  function toggleKnown(id: number) {
    const has = slot.knownMoveIds.includes(id);
    onChange({ ...slot, knownMoveIds: has ? slot.knownMoveIds.filter((m) => m !== id) : [...slot.knownMoveIds, id] });
  }
  function toggleSuspected(id: number) {
    const has = slot.suspectedMoveIds.includes(id);
    onChange({ ...slot, suspectedMoveIds: has ? slot.suspectedMoveIds.filter((m) => m !== id) : [...slot.suspectedMoveIds, id] });
  }

  return (
    <div className="bg-panel rounded-xl2 p-4 shadow-card animate-fadein space-y-3 border-l-2 border-l-[#C03028]/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display font-semibold text-ink">{pokemon.name_es}</span>
          <div className="flex gap-1">
            {pokemon.types.map((tp) => (
              <TypeBadge key={tp.id} type={tp} size="sm" />
            ))}
          </div>
        </div>
        <button onClick={onRemove} className="text-ink-soft hover:text-[#C03028] transition-colors" aria-label={t("team.remove")}>
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          {t("team.item")}
          <input
            value={slot.item}
            onChange={(e) => onChange({ ...slot, item: e.target.value })}
            placeholder={t("team.item_placeholder")}
            className="bg-hover rounded-lg px-2 py-1.5 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          {t("team.ability")}
          <select
            value={slot.ability}
            onChange={(e) => onChange({ ...slot, ability: e.target.value })}
            className="bg-hover rounded-lg px-2 py-1.5 text-sm text-ink outline-none"
          >
            <option value="">—</option>
            {abilityOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      <MoveMultiSelect
        title={t("team.known_moves")}
        allMoves={allMoves}
        selectedIds={slot.knownMoveIds}
        disabledIds={slot.suspectedMoveIds}
        onToggle={toggleKnown}
      />
      <MoveMultiSelect
        title={t("team.suspected_moves")}
        allMoves={allMoves}
        selectedIds={slot.suspectedMoveIds}
        disabledIds={slot.knownMoveIds}
        onToggle={toggleSuspected}
      />
    </div>
  );
}
