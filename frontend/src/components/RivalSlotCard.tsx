import { useState } from "react";
import { X } from "lucide-react";
import { PokemonDetail, RivalSlot, MoveSummary, ItemSummary } from "../types";
import { TypeBadge } from "./TypeBadge";
import { ItemCombobox } from "./ItemCombobox";
import { useI18n } from "../i18n";

/**
 * Lista de movimientos con casillas.
 *
 * `title` ya no vale solo de rótulo visual (8.2): también nombra el grupo y el
 * campo de filtro. En una tarjeta de rival hay DOS de estas —«conocidos» y
 * «sospechados»— y en un equipo de seis rivales, doce en la misma página. Sin
 * nombre propio, un lector de pantalla las anuncia todas igual.
 */
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
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState("");
  const nombre = (o: { name_es: string; name_en: string }) =>
    lang === "en" ? o.name_en : o.name_es;
  const filtered = allMoves.filter((m) => nombre(m).toLowerCase().includes(filter.toLowerCase()));
  return (
    <div role="group" aria-label={title}>
      <div className="text-xs text-ink-soft mb-1">{title}</div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t("search.placeholder")}
        aria-label={t("team.filterMovesIn", { name: title })}
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
              aria-pressed={selected}
              className={`w-full flex items-center justify-between text-left px-2 py-1 rounded-lg text-sm transition-colors ${
                selected
                  ? "bg-[#1C3350] text-ink"
                  : disabled
                  ? "text-ink-soft/30 cursor-not-allowed"
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
  );
}

export function RivalSlotCard({
  slot,
  pokemon,
  allMoves,
  allItems,
  onChange,
  onRemove,
}: {
  slot: RivalSlot;
  pokemon: PokemonDetail | null;
  allMoves: MoveSummary[];
  allItems: ItemSummary[];
  onChange: (updated: RivalSlot) => void;
  onRemove: () => void;
}) {
  const { t, lang } = useI18n();
  const nombre = (o: { name_es: string; name_en: string }) =>
    lang === "en" ? o.name_en : o.name_es;

  if (!pokemon) {
    return (
      <div className="bg-panel rounded-xl2 p-4 shadow-card animate-fadein text-ink-soft text-sm">
        {t("common.loading")}
      </div>
    );
  }

  /* Rótulo traducido, valor en `name_es`: ver la nota de `TeamSlotCard`. */
  const abilityOptions = [
    ...pokemon.abilities.map((a) => ({ value: a.name_es, label: nombre(a) })),
    ...(pokemon.hidden_ability
      ? [
          {
            value: pokemon.hidden_ability.name_es,
            label: `${nombre(pokemon.hidden_ability)} (${t("pokemon.hidden_ability")})`,
          },
        ]
      : []),
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
        <div className="flex flex-col gap-1 text-xs text-ink-soft">
          <span>{t("team.item")}</span>
          <ItemCombobox
            value={slot.item}
            items={allItems}
            label={t("team.itemFor", { name: nombre(pokemon) })}
            onChange={(item) => onChange({ ...slot, item })}
          />
        </div>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          {t("team.ability")}
          <select
            value={slot.ability}
            onChange={(e) => onChange({ ...slot, ability: e.target.value })}
            className="bg-hover rounded-lg px-2 py-1.5 text-sm text-ink outline-none"
          >
            <option value="">—</option>
            {abilityOptions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <MoveMultiSelect
        title={t("team.knownMovesOf", { name: nombre(pokemon) })}
        allMoves={allMoves}
        selectedIds={slot.knownMoveIds}
        disabledIds={slot.suspectedMoveIds}
        onToggle={toggleKnown}
      />
      <MoveMultiSelect
        title={t("team.suspectedMovesOf", { name: nombre(pokemon) })}
        allMoves={allMoves}
        selectedIds={slot.suspectedMoveIds}
        disabledIds={slot.knownMoveIds}
        onToggle={toggleSuspected}
      />
    </div>
  );
}
