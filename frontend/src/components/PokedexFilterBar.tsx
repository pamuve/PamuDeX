/**
 * PamuDeX — Fase 9
 * Filtros y orden de la Pokédex: tipo (hasta dos), generación, capturados y el
 * criterio de orden. El filtrado en sí está en `lib/pokedex.ts`.
 */
import { ArrowDownUp, X } from "lucide-react";
import type { PokeType } from "../types";
import { NO_FILTERS, hasActiveFilters, type PokedexFilters, type SortKey, type CaptureFilter } from "../lib/pokedex";
import { readableInk } from "../lib/theme";
import { useI18n } from "../i18n";

const SORTS: SortKey[] = ["dex", "name", "total", "hp", "atk", "def", "spa", "spd", "spe"];
const CAPTURES: CaptureFilter[] = ["all", "captured", "missing"];
const SELECT =
  "min-h-[2.75rem] rounded-lg bg-hover px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function PokedexFilterBar({
  types,
  generations,
  value,
  onChange,
  showCapture,
}: {
  types: PokeType[];
  generations: number[];
  value: PokedexFilters;
  onChange: (next: PokedexFilters) => void;
  showCapture: boolean;
}) {
  const { t, name } = useI18n();

  function alternarTipo(id: string) {
    const puesto = value.types.includes(id);
    // Un Pokémon tiene como mucho dos tipos: con un tercero no saldría ninguno,
    // así que el tercero SUSTITUYE al primero que se eligió.
    const next = puesto ? value.types.filter((x) => x !== id) : [...value.types, id].slice(-2);
    onChange({ ...value, types: next });
  }

  return (
    <div className="card space-y-3">
      <div role="group" aria-label={t("pokedex.filterType")} className="flex flex-wrap gap-1.5">
        {types.map((tp) => {
          const activo = value.types.includes(tp.id);
          return (
            <button
              key={tp.id}
              type="button"
              aria-pressed={activo}
              onClick={() => alternarTipo(tp.id)}
              className={`pressable color-chip min-h-[2.25rem] rounded-full px-3 text-xs font-semibold uppercase tracking-wide ${
                activo ? "ring-2 ring-ink" : "opacity-45 hover:opacity-80"
              }`}
              style={{ backgroundColor: tp.color, color: readableInk(tp.color), ["--chip-color" as string]: tp.color }}
            >
              {name(tp)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          {t("pokedex.generation")}
          <select
            className={SELECT}
            value={value.generation ?? ""}
            onChange={(e) => onChange({ ...value, generation: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">{t("pokedex.allGenerations")}</option>
            {generations.map((g) => (
              <option key={g} value={g}>
                {t("pokedex.generationN", { n: g })}
              </option>
            ))}
          </select>
        </label>

        {showCapture && (
          <label className="flex flex-col gap-1 text-xs text-ink-soft">
            {t("captures.filter")}
            <select
              className={SELECT}
              value={value.capture}
              onChange={(e) => onChange({ ...value, capture: e.target.value as CaptureFilter })}
            >
              {CAPTURES.map((c) => (
                <option key={c} value={c}>
                  {t(`captures.filter.${c}`)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          {t("pokedex.sort")}
          <select
            className={SELECT}
            value={value.sort}
            onChange={(e) => onChange({ ...value, sort: e.target.value as SortKey, desc: false })}
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {s === "dex" ? t("pokedex.sort.dex") : s === "name" ? t("pokedex.sort.name") : t(`stat.${s}`)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          aria-pressed={value.desc}
          aria-label={t("pokedex.reverse")}
          title={t("pokedex.reverse")}
          onClick={() => onChange({ ...value, desc: !value.desc })}
          className={`pressable flex h-11 w-11 items-center justify-center rounded-lg ${
            value.desc ? "bg-accent/20 text-ink" : "bg-hover text-ink-soft hover:text-ink"
          }`}
        >
          <ArrowDownUp size={18} aria-hidden="true" />
        </button>

        {hasActiveFilters(value) && (
          <button type="button" onClick={() => onChange(NO_FILTERS)} className="btn-ghost">
            <X size={16} aria-hidden="true" />
            {t("pokedex.clear")}
          </button>
        )}
      </div>
    </div>
  );
}
