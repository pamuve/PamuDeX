/**
 * PamuDeX — Tarea 3.3
 * Formulario visual de un Pokémon dentro de una sesión.
 * Nunca se edita JSON a mano: esto escribe el override de `sessions.data_json`.
 */

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, Loader2 } from "lucide-react";
import type { PokemonDetail, TypeMeta } from "../../lib/apiSession";
import { typeName } from "../../lib/apiSession";
import type { EntityPatch } from "../../hooks/useSessionOverride";
import { Field, inputClass, btnGhost, btnPrimary } from "./FormField";

const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
type StatKey = (typeof STAT_KEYS)[number];

interface Draft {
  name_es: string;
  name_en: string;
  dex: string;
  generation: string;
  types: string[];
  abilities: string;
  hidden_ability: string;
  stats: Record<StatKey, string>;
  height_m: string;
  weight_kg: string;
  sprite: string;
}

interface Props {
  base: PokemonDetail;
  override: EntityPatch;
  types: TypeMeta[];
  lang?: string;
  saving: boolean;
  t: (key: string, params?: Record<string, string>) => string;
  onSave: (patch: EntityPatch) => void | Promise<void>;
  onReset: () => void | Promise<void>;
}

/* ---------- normalizadores: la API puede devolver objetos o cadenas ---------- */

export function toTypeIds(value: unknown, types: TypeMeta[]): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  const ids: string[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      const lower = item.toLowerCase();
      const match =
        types.find((type) => type.id === lower) ||
        types.find((type) => type.name_es === item || type.name_en === item);
      if (match) ids.push(match.id);
    } else if (item && typeof item === "object") {
      const raw = (item as Record<string, unknown>).id;
      if (typeof raw === "string") ids.push(raw.toLowerCase());
    }
  }
  return ids;
}

function toNameList(value: unknown): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return String(obj.name_es || obj.name_en || obj.name || "");
      }
      return "";
    })
    .filter(Boolean);
}

/**
 * El campo se edita como texto ("Espesura, Clorofila"), pero `/api/pokemon/:id`
 * devuelve las habilidades como objetos `{ name_es, name_en, effect_es, is_hidden }`
 * y `PokemonDetail.tsx` lee `.name_es` / `.effect_es`. El override tiene que
 * conservar esa forma o la ficha se rompería al leerla dentro de la sesión.
 *
 * Si el nombre ya existía se reutiliza el objeto original tal cual (así el
 * `JSON.stringify` de `compare` coincide y no se guarda un patch fantasma);
 * si es nuevo, se crea el objeto mínimo con la misma forma.
 */
function toAbilityObjects(names: string[], original: unknown, isHidden: 0 | 1): unknown[] {
  const list: unknown[] = Array.isArray(original) ? original : original ? [original] : [];
  const originals = list.filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object"
  );

  return names.map((name) => {
    const previous = originals.find(
      (item) => item.name_es === name || item.name_en === name || item.name === name
    );
    if (previous) return previous;
    return { name_es: name, name_en: name, effect_es: "", is_hidden: isHidden };
  });
}

/** `hidden_ability` es un objeto suelto o `null`, nunca un array. */
function toHiddenAbility(names: string[], original: unknown): unknown {
  if (!names.length) return null;
  return toAbilityObjects(names.slice(0, 1), original, 1)[0];
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/* --------------------------------- componente -------------------------------- */

export default function PokemonForm({
  base,
  override,
  types,
  lang,
  saving,
  t,
  onSave,
  onReset,
}: Props) {
  const merged = useMemo(() => ({ ...base, ...override }), [base, override]);

  const build = useMemo<() => Draft>(
    () => () => ({
      name_es: str(merged.name_es),
      name_en: str(merged.name_en),
      dex: str(merged.dex),
      generation: str(merged.generation),
      types: toTypeIds(merged.types, types),
      abilities: toNameList(merged.abilities).join(", "),
      hidden_ability: toNameList(merged.hidden_ability).join(", "),
      stats: STAT_KEYS.reduce((acc, key) => {
        const stats = (merged.stats || {}) as Record<string, unknown>;
        acc[key] = str(stats[key]);
        return acc;
      }, {} as Record<StatKey, string>),
      height_m: str(merged.height_m),
      weight_kg: str(merged.weight_kg),
      sprite: str(merged.sprite),
    }),
    [merged, types]
  );

  const [draft, setDraft] = useState<Draft>(build);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(build());
    setErrors({});
  }, [build]);

  const isModified = (field: string) => Object.prototype.hasOwnProperty.call(override, field);
  const set = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [field]: value }));
  const setStat = (key: StatKey, value: string) =>
    setDraft((prev) => ({ ...prev, stats: { ...prev.stats, [key]: value } }));

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};

    if (!draft.name_es.trim()) found.name_es = t("editor.error.required");
    if (!draft.name_en.trim()) found.name_en = t("editor.error.required");

    const dex = Number(draft.dex);
    if (!Number.isInteger(dex) || dex <= 0) found.dex = t("editor.error.dex");

    const generation = Number(draft.generation);
    if (!Number.isInteger(generation) || generation < 1 || generation > 9) {
      found.generation = t("editor.error.generation");
    }

    const uniqueTypes = draft.types.filter(Boolean);
    if (uniqueTypes.length === 0) found.types = t("editor.error.typesMin");
    if (uniqueTypes.length === 2 && uniqueTypes[0] === uniqueTypes[1]) {
      found.types = t("editor.error.typesRepeated");
    }

    for (const key of STAT_KEYS) {
      const value = Number(draft.stats[key]);
      if (!Number.isInteger(value) || value < 1 || value > 255) {
        found.stats = t("editor.error.stats");
        break;
      }
    }

    if (draft.height_m !== "" && Number(draft.height_m) < 0) found.height_m = t("editor.error.positive");
    if (draft.weight_kg !== "" && Number(draft.weight_kg) < 0) found.weight_kg = t("editor.error.positive");

    return found;
  }

  /** Solo se guarda lo que difiere del dato global. */
  function buildPatch(): EntityPatch {
    const patch: EntityPatch = {};
    const baseTypes = toTypeIds(base.types, types);

    const compare = (field: string, value: unknown, baseValue: unknown) => {
      if (JSON.stringify(value) !== JSON.stringify(baseValue)) patch[field] = value;
      else if (isModified(field)) patch[field] = undefined; // vuelve al global
    };

    compare("name_es", draft.name_es.trim(), str(base.name_es));
    compare("name_en", draft.name_en.trim(), str(base.name_en));
    compare("dex", Number(draft.dex), Number(base.dex));
    compare("generation", Number(draft.generation), Number(base.generation));
    compare("types", draft.types.filter(Boolean), baseTypes);
    const splitNames = (value: string) => value.split(",").map((a) => a.trim()).filter(Boolean);
    compare(
      "abilities",
      toAbilityObjects(splitNames(draft.abilities), base.abilities, 0),
      Array.isArray(base.abilities) ? base.abilities : toAbilityObjects(toNameList(base.abilities), base.abilities, 0)
    );
    compare(
      "hidden_ability",
      toHiddenAbility(splitNames(draft.hidden_ability), base.hidden_ability),
      base.hidden_ability ?? null
    );
    compare("height_m", Number(draft.height_m), Number(base.height_m));
    compare("weight_kg", Number(draft.weight_kg), Number(base.weight_kg));
    if (draft.sprite.trim() || base.sprite) {
      compare("sprite", draft.sprite.trim(), str(base.sprite));
    }

    const baseStats = (base.stats || {}) as Record<string, number>;
    const changedStats: Record<string, number> = {};
    for (const key of STAT_KEYS) {
      const value = Number(draft.stats[key]);
      if (value !== Number(baseStats[key])) changedStats[key] = value;
    }
    if (Object.keys(changedStats).length) patch.stats = changedStats;
    else if (isModified("stats")) patch.stats = undefined;

    return patch;
  }

  function handleSubmit() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    onSave(buildPatch());
  }

  const typeOptions = types.map((type) => (
    <option key={type.id} value={type.id}>
      {typeName(type, lang)}
    </option>
  ));

  return (
    <div className="rounded-xl2 bg-panel p-4 shadow-card animate-fadein">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("editor.fields.nameEs")} htmlFor="pf-name-es" modified={isModified("name_es")}
          modifiedLabel={t("editor.modified")} error={errors.name_es}>
          <input id="pf-name-es" className={inputClass} value={draft.name_es}
            onChange={(e) => set("name_es", e.target.value)} />
        </Field>

        <Field label={t("editor.fields.nameEn")} htmlFor="pf-name-en" modified={isModified("name_en")}
          modifiedLabel={t("editor.modified")} error={errors.name_en}>
          <input id="pf-name-en" className={inputClass} value={draft.name_en}
            onChange={(e) => set("name_en", e.target.value)} />
        </Field>

        <Field label={t("editor.fields.dex")} htmlFor="pf-dex" modified={isModified("dex")}
          modifiedLabel={t("editor.modified")} error={errors.dex}>
          <input id="pf-dex" type="number" min={1} inputMode="numeric" className={inputClass}
            value={draft.dex} onChange={(e) => set("dex", e.target.value)} />
        </Field>

        <Field label={t("editor.fields.generation")} htmlFor="pf-gen" modified={isModified("generation")}
          modifiedLabel={t("editor.modified")} error={errors.generation}>
          <input id="pf-gen" type="number" min={1} max={9} inputMode="numeric" className={inputClass}
            value={draft.generation} onChange={(e) => set("generation", e.target.value)} />
        </Field>

        <Field className="sm:col-span-2" label={t("editor.fields.types")} modified={isModified("types")}
          modifiedLabel={t("editor.modified")} error={errors.types}>
          <div className="flex gap-2">
            <select className={inputClass} aria-label={t("editor.fields.type1")}
              value={draft.types[0] || ""}
              onChange={(e) => set("types", [e.target.value, draft.types[1] || ""].filter(Boolean))}>
              <option value="">—</option>
              {typeOptions}
            </select>
            <select className={inputClass} aria-label={t("editor.fields.type2")}
              value={draft.types[1] || ""}
              onChange={(e) => set("types", [draft.types[0] || "", e.target.value].filter(Boolean))}>
              <option value="">—</option>
              {typeOptions}
            </select>
          </div>
        </Field>

        <Field label={t("editor.fields.abilities")} htmlFor="pf-abilities" modified={isModified("abilities")}
          modifiedLabel={t("editor.modified")} hint={t("editor.hints.commaSeparated")}>
          <input id="pf-abilities" className={inputClass} value={draft.abilities}
            onChange={(e) => set("abilities", e.target.value)} />
        </Field>

        <Field label={t("editor.fields.hiddenAbility")} htmlFor="pf-hidden"
          modified={isModified("hidden_ability")} modifiedLabel={t("editor.modified")}>
          <input id="pf-hidden" className={inputClass} value={draft.hidden_ability}
            onChange={(e) => set("hidden_ability", e.target.value)} />
        </Field>

        <Field className="sm:col-span-2" label={t("editor.fields.stats")} modified={isModified("stats")}
          modifiedLabel={t("editor.modified")} error={errors.stats} hint={t("editor.hints.statRange")}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {STAT_KEYS.map((key) => (
              <div key={key}>
                <span className="mb-1 block text-center text-[11px] uppercase text-ink-soft">
                  {t(`editor.stats.${key}`)}
                </span>
                <input type="number" min={1} max={255} inputMode="numeric"
                  aria-label={t(`editor.stats.${key}`)}
                  className={`${inputClass} text-center`} value={draft.stats[key]}
                  onChange={(e) => setStat(key, e.target.value)} />
              </div>
            ))}
          </div>
        </Field>

        <Field label={t("editor.fields.height")} htmlFor="pf-height" modified={isModified("height_m")}
          modifiedLabel={t("editor.modified")} error={errors.height_m}>
          <input id="pf-height" type="number" step="0.1" min={0} inputMode="decimal"
            className={inputClass} value={draft.height_m}
            onChange={(e) => set("height_m", e.target.value)} />
        </Field>

        <Field label={t("editor.fields.weight")} htmlFor="pf-weight" modified={isModified("weight_kg")}
          modifiedLabel={t("editor.modified")} error={errors.weight_kg}>
          <input id="pf-weight" type="number" step="0.1" min={0} inputMode="decimal"
            className={inputClass} value={draft.weight_kg}
            onChange={(e) => set("weight_kg", e.target.value)} />
        </Field>

        <Field className="sm:col-span-2" label={t("editor.fields.sprite")} htmlFor="pf-sprite"
          modified={isModified("sprite")} modifiedLabel={t("editor.modified")}
          hint={t("editor.hints.sprite")}>
          <input id="pf-sprite" className={inputClass} value={draft.sprite}
            placeholder="/sprites/pikachu.png" onChange={(e) => set("sprite", e.target.value)} />
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={btnGhost} onClick={() => onReset()} disabled={saving}>
          <RotateCcw size={16} aria-hidden="true" />
          {t("editor.restore")}
        </button>
        <button type="button" className={btnPrimary} onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
          {t("editor.save")}
        </button>
      </div>
    </div>
  );
}
