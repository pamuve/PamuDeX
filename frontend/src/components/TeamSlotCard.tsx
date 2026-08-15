import { useState } from "react";
import { X } from "lucide-react";
import { PokemonDetail, TeamSlot, MoveSummary } from "../types";
import { NATURES, MAX_MOVES_PER_SLOT } from "../lib/team";
import { TypeBadge } from "./TypeBadge";
import { useI18n } from "../i18n";

export function TeamSlotCard({
  slot,
  pokemon,
  allMoves,
  onChange,
  onRemove,
}: {
  slot: TeamSlot;
  pokemon: PokemonDetail | null;
  allMoves: MoveSummary[];
  onChange: (updated: TeamSlot) => void;
  onRemove: () => void;
}) {
  const { t, lang } = useI18n();
  const [moveFilter, setMoveFilter] = useState("");
  const nombre = (o: { name_es: string; name_en: string }) =>
    lang === "en" ? o.name_en : o.name_es;

  if (!pokemon) {
    return <div className="bg-panel rounded-xl2 p-4 shadow-card animate-fadein text-ink-soft text-sm">Cargando...</div>;
  }

  const abilityOptions = [
    ...pokemon.abilities.map((a) => a.name_es),
    ...(pokemon.hidden_ability ? [pokemon.hidden_ability.name_es] : []),
  ];

  const filteredMoves = allMoves.filter((m) => nombre(m).toLowerCase().includes(moveFilter.toLowerCase()));

  function toggleMove(moveId: number) {
    const has = slot.moveIds.includes(moveId);
    let moveIds: number[];
    if (has) moveIds = slot.moveIds.filter((id) => id !== moveId);
    else if (slot.moveIds.length < MAX_MOVES_PER_SLOT) moveIds = [...slot.moveIds, moveId];
    else return;
    onChange({ ...slot, moveIds });
  }

  return (
    <div className="bg-panel rounded-xl2 p-4 shadow-card animate-fadein space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display font-semibold text-ink">{nombre(pokemon)}</span>
          <div className="flex gap-1">
            {pokemon.types.map((tp) => (
              <TypeBadge key={tp.id} type={tp} size="sm" />
            ))}
          </div>
        </div>
        <button onClick={onRemove} className="text-ink-soft hover:text-[#C03028] transition-colors" aria-label={t("team.removeNamed", { name: nombre(pokemon) })}>
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

        <label className="flex flex-col gap-1 text-xs text-ink-soft col-span-2">
          {t("team.nature")}
          <select
            value={slot.nature}
            onChange={(e) => onChange({ ...slot, nature: e.target.value })}
            className="bg-hover rounded-lg px-2 py-1.5 text-sm text-ink outline-none"
          >
            {NATURES.map((n) => (
              <option key={n.name_es} value={n.name_es}>
                {n.name_es}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/*
        `group` con nombre y `aria-pressed` en cada movimiento (8.2). Antes eran
        botones sueltos: el lector de pantalla leía el nombre del movimiento sin
        decir si estaba elegido —la marca era un «✓» de texto suelto— ni a qué
        Pokémon pertenecía la lista, que en un equipo de seis se repite seis veces.
      */}
      <div role="group" aria-label={t("team.movesFor", { name: nombre(pokemon) })}>
        <div className="flex items-center justify-between text-xs text-ink-soft mb-1">
          <span>{t("team.moves")}</span>
          {/* El recuento cambia al pulsar y está lejos del botón: se anuncia. */}
          <span role="status" aria-live="polite">
            {t("team.moves_selected", { count: slot.moveIds.length })}
          </span>
        </div>
        <input
          value={moveFilter}
          onChange={(e) => setMoveFilter(e.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("team.filterMoves")}
          className="w-full bg-hover rounded-lg px-2 py-1.5 text-sm text-ink outline-none mb-2"
        />
        <div className="max-h-32 overflow-auto space-y-1 pr-1">
          {filteredMoves.map((m) => {
            const selected = slot.moveIds.includes(m.id);
            const disabled = !selected && slot.moveIds.length >= MAX_MOVES_PER_SLOT;
            return (
              <button
                key={m.id}
                onClick={() => toggleMove(m.id)}
                disabled={disabled}
                aria-pressed={selected}
                className={`w-full flex items-center justify-between text-left px-2 py-1 rounded-lg text-sm transition-colors ${
                  selected
                    ? "bg-[#1C3350] text-ink"
                    : disabled
                    ? "text-ink-soft/40 cursor-not-allowed"
                    : "text-ink-soft hover:bg-hover"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: m.color }}
                    aria-hidden="true"
                  />
                  {nombre(m)}
                </span>
                {/* Decorativo: `aria-pressed` ya dice si está elegido. */}
                {selected && (
                  <span className="text-xs" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
