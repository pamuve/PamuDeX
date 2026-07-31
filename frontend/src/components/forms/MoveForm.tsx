/**
 * PamuDeX — Tarea 3.4
 * Formulario visual de un movimiento.
 */

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, Loader2 } from "lucide-react";
import type { MoveDetail, TypeMeta } from "../../lib/apiSession";
import { typeName } from "../../lib/apiSession";
import type { EntityPatch } from "../../hooks/useSessionOverride";
import { Field, inputClass, btnGhost, btnPrimary } from "./FormField";

interface Props {
  base: MoveDetail;
  override: EntityPatch;
  types: TypeMeta[];
  lang?: string;
  saving: boolean;
  t: (key: string, params?: Record<string, string>) => string;
  onSave: (patch: EntityPatch) => void | Promise<void>;
  onReset: () => void | Promise<void>;
}

/**
 * El formato canónico del proyecto es el de la semilla (`backend/data/moves.json`)
 * y el de `types.ts`: "fisico" | "especial" | "estado". `lib/damage.ts` compara
 * contra esos valores, así que el override tiene que guardarlos igual o el motor
 * de daño dejaría de reconocer la categoría.
 */
const CATEGORIES = ["fisico", "especial", "estado"];

/** Acepta lo que venga (semilla, inglés, con tilde) y lo lleva al formato canónico. */
function normalizeCategory(value: unknown): string {
  const raw = String(value ?? "").toLowerCase();
  if (["fisico", "físico", "physical"].includes(raw)) return "fisico";
  if (["especial", "special"].includes(raw)) return "especial";
  if (["estado", "status"].includes(raw)) return "estado";
  return raw || "fisico";
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export default function MoveForm({ base, override, types, lang, saving, t, onSave, onReset }: Props) {
  const merged = useMemo(() => ({ ...base, ...override }), [base, override]);

  const [draft, setDraft] = useState(() => ({
    name_es: str(merged.name_es),
    name_en: str(merged.name_en),
    type_id: str(merged.type_id),
    category: normalizeCategory(merged.category),
    power: str(merged.power),
    accuracy: str(merged.accuracy),
    pp: str(merged.pp),
    priority: str(merged.priority ?? 0),
    makes_contact: Boolean(merged.makes_contact),
    effect_es: str(merged.effect_es),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft({
      name_es: str(merged.name_es),
      name_en: str(merged.name_en),
      type_id: str(merged.type_id),
      category: normalizeCategory(merged.category),
      power: str(merged.power),
      accuracy: str(merged.accuracy),
      pp: str(merged.pp),
      priority: str(merged.priority ?? 0),
      makes_contact: Boolean(merged.makes_contact),
      effect_es: str(merged.effect_es),
    });
    setErrors({});
  }, [merged]);

  const isModified = (field: string) => Object.prototype.hasOwnProperty.call(override, field);
  const set = (field: string, value: string | boolean) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  function handleSubmit() {
    const found: Record<string, string> = {};
    if (!draft.name_es.trim()) found.name_es = t("editor.error.required");
    if (!draft.name_en.trim()) found.name_en = t("editor.error.required");
    if (!draft.type_id) found.type_id = t("editor.error.required");

    const inRange = (value: string, min: number, max: number) =>
      value === "" || (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max);

    if (!inRange(draft.power, 0, 999)) found.power = t("editor.error.range");
    if (!inRange(draft.accuracy, 0, 100)) found.accuracy = t("editor.error.accuracy");
    if (!inRange(draft.pp, 1, 99)) found.pp = t("editor.error.range");
    if (!inRange(draft.priority, -7, 7)) found.priority = t("editor.error.priority");

    setErrors(found);
    if (Object.keys(found).length) return;

    const patch: EntityPatch = {};
    const compare = (field: string, value: unknown, baseValue: unknown) => {
      if (JSON.stringify(value) !== JSON.stringify(baseValue)) patch[field] = value;
      else if (isModified(field)) patch[field] = undefined;
    };
    const num = (value: string) => (value === "" ? null : Number(value));

    compare("name_es", draft.name_es.trim(), str(base.name_es));
    compare("name_en", draft.name_en.trim(), str(base.name_en));
    compare("type_id", draft.type_id, str(base.type_id));
    compare("category", draft.category, normalizeCategory(base.category));
    compare("power", num(draft.power), base.power === undefined ? null : base.power);
    compare("accuracy", num(draft.accuracy), base.accuracy === undefined ? null : base.accuracy);
    compare("pp", num(draft.pp), base.pp === undefined ? null : base.pp);
    compare("priority", Number(draft.priority || 0), Number(base.priority ?? 0));
    compare("makes_contact", draft.makes_contact ? 1 : 0, base.makes_contact ? 1 : 0);
    compare("effect_es", draft.effect_es, str(base.effect_es));

    onSave(patch);
  }

  return (
    <div className="rounded-xl2 bg-panel p-4 shadow-card animate-fadein">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("editor.fields.nameEs")} htmlFor="mf-name-es" modified={isModified("name_es")}
          modifiedLabel={t("editor.modified")} error={errors.name_es}>
          <input id="mf-name-es" className={inputClass} value={draft.name_es}
            onChange={(e) => set("name_es", e.target.value)} />
        </Field>

        <Field label={t("editor.fields.nameEn")} htmlFor="mf-name-en" modified={isModified("name_en")}
          modifiedLabel={t("editor.modified")} error={errors.name_en}>
          <input id="mf-name-en" className={inputClass} value={draft.name_en}
            onChange={(e) => set("name_en", e.target.value)} />
        </Field>

        <Field label={t("editor.fields.type")} htmlFor="mf-type" modified={isModified("type_id")}
          modifiedLabel={t("editor.modified")} error={errors.type_id}>
          <select id="mf-type" className={inputClass} value={draft.type_id}
            onChange={(e) => set("type_id", e.target.value)}>
            <option value="">—</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>{typeName(type, lang)}</option>
            ))}
          </select>
        </Field>

        <Field label={t("editor.fields.category")} htmlFor="mf-category" modified={isModified("category")}
          modifiedLabel={t("editor.modified")}>
          <select id="mf-category" className={inputClass} value={draft.category}
            onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{t(`editor.categories.${category}`)}</option>
            ))}
          </select>
        </Field>

        <Field label={t("editor.fields.power")} htmlFor="mf-power" modified={isModified("power")}
          modifiedLabel={t("editor.modified")} error={errors.power} hint={t("editor.hints.emptyIsNone")}>
          <input id="mf-power" type="number" min={0} inputMode="numeric" className={inputClass}
            value={draft.power} onChange={(e) => set("power", e.target.value)} />
        </Field>

        <Field label={t("editor.fields.accuracy")} htmlFor="mf-accuracy" modified={isModified("accuracy")}
          modifiedLabel={t("editor.modified")} error={errors.accuracy} hint={t("editor.hints.emptyIsNone")}>
          <input id="mf-accuracy" type="number" min={0} max={100} inputMode="numeric"
            className={inputClass} value={draft.accuracy}
            onChange={(e) => set("accuracy", e.target.value)} />
        </Field>

        <Field label={t("editor.fields.pp")} htmlFor="mf-pp" modified={isModified("pp")}
          modifiedLabel={t("editor.modified")} error={errors.pp}>
          <input id="mf-pp" type="number" min={1} max={99} inputMode="numeric" className={inputClass}
            value={draft.pp} onChange={(e) => set("pp", e.target.value)} />
        </Field>

        <Field label={t("editor.fields.priority")} htmlFor="mf-priority" modified={isModified("priority")}
          modifiedLabel={t("editor.modified")} error={errors.priority}>
          <input id="mf-priority" type="number" min={-7} max={7} inputMode="numeric"
            className={inputClass} value={draft.priority}
            onChange={(e) => set("priority", e.target.value)} />
        </Field>

        <Field className="sm:col-span-2" label={t("editor.fields.contact")}
          modified={isModified("makes_contact")} modifiedLabel={t("editor.modified")}>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-base px-3 py-2 text-ink">
            <input type="checkbox" className="h-4 w-4 accent-current" checked={draft.makes_contact}
              onChange={(e) => set("makes_contact", e.target.checked)} />
            <span className="text-sm">{t("editor.fields.contactHint")}</span>
          </label>
        </Field>

        <Field className="sm:col-span-2" label={t("editor.fields.effect")} htmlFor="mf-effect"
          modified={isModified("effect_es")} modifiedLabel={t("editor.modified")}>
          <textarea id="mf-effect" rows={3} className={inputClass} value={draft.effect_es}
            onChange={(e) => set("effect_es", e.target.value)} />
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
