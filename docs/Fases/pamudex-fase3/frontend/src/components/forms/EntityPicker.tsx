/**
 * PamuDeX — Tareas 3.3 / 3.4
 * Lista con buscador para elegir qué entidad se está editando.
 * A la izquierda en escritorio, apilada encima del formulario en móvil.
 */

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { inputClass } from "./FormField";

export interface PickerItem {
  id: string | number;
  label: string;
  sublabel?: string;
  modified?: boolean;
  color?: string;
}

interface Props {
  items: PickerItem[];
  selectedId: string | number | null;
  placeholder: string;
  emptyLabel: string;
  onSelect: (id: string | number) => void;
}

export default function EntityPicker({
  items,
  selectedId,
  placeholder,
  emptyLabel,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(needle) ||
        String(item.sublabel || "").toLowerCase().includes(needle) ||
        String(item.id).includes(needle)
    );
  }, [items, query]);

  return (
    <div className="rounded-xl2 bg-panel p-3 shadow-card">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
          aria-hidden="true"
        />
        <input
          className={`${inputClass} pl-9`}
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <ul className="mt-2 max-h-64 overflow-y-auto lg:max-h-[60vh]">
        {filtered.length === 0 && <li className="px-2 py-6 text-center text-sm text-ink-soft">{emptyLabel}</li>}

        {filtered.map((item) => {
          const isSelected = String(item.id) === String(selectedId);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={isSelected ? "true" : undefined}
                className={
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors " +
                  "focus:outline-none focus:ring-2 focus:ring-ink-soft/40 " +
                  (isSelected ? "bg-hover text-ink" : "text-ink-soft hover:bg-hover hover:text-ink")
                }
              >
                {item.color && (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.sublabel && (
                  <span className="shrink-0 text-xs text-ink-soft">{item.sublabel}</span>
                )}
                {item.modified && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--color-accent, #7FB4E8)" }}
                    aria-hidden="true"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
