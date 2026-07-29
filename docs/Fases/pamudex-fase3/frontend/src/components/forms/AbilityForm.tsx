/**
 * PamuDeX — Tarea 3.4
 * Formulario visual de una habilidad.
 */

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, Loader2 } from "lucide-react";
import type { AbilityDetail } from "../../lib/apiSession";
import type { EntityPatch } from "../../hooks/useSessionOverride";
import { Field, inputClass, btnGhost, btnPrimary } from "./FormField";

interface Props {
  base: AbilityDetail;
  override: EntityPatch;
  saving: boolean;
  t: (key: string, params?: Record<string, string>) => string;
  onSave: (patch: EntityPatch) => void | Promise<void>;
  onReset: () => void | Promise<void>;
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export default function AbilityForm({ base, override, saving, t, onSave, onReset }: Props) {
  const merged = useMemo(() => ({ ...base, ...override }), [base, override]);

  const [draft, setDraft] = useState(() => ({
    name_es: str(merged.name_es),
    name_en: str(merged.name_en),
    generation: str(merged.generation ?? ""),
    effect_es: str(merged.effect_es),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft({
      name_es: str(merged.name_es),
      name_en: str(merged.name_en),
      generation: str(merged.generation ?? ""),
      effect_es: str(merged.effect_es),
    });
    setErrors({});
  }, [merged]);

  const isModified = (field: string) => Object.prototype.hasOwnProperty.call(override, field);
  const set = (field: string, value: string) => setDraft((prev) => ({ ...prev, [field]: value }));

  function handleSubmit() {
    const found: Record<string, string> = {};
    if (!draft.name_es.trim()) found.name_es = t("editor.error.required");
    if (!draft.name_en.trim()) found.name_en = t("editor.error.required");

    const generation = Number(draft.generation);
    if (draft.generation !== "" && (!Number.isInteger(generation) || generation < 1 || generation > 9)) {
      found.generation = t("editor.error.generation");
    }

    setErrors(found);
    if (Object.keys(found).length) return;

    const patch: EntityPatch = {};
    const compare = (field: string, value: unknown, baseValue: unknown) => {
      if (JSON.stringify(value) !== JSON.stringify(baseValue)) patch[field] = value;
      else if (isModified(field)) patch[field] = undefined;
    };

    compare("name_es", draft.name_es.trim(), str(base.name_es));
    compare("name_en", draft.name_en.trim(), str(base.name_en));
    compare("generation", draft.generation === "" ? null : generation,
      base.generation === undefined ? null : base.generation);
    compare("effect_es", draft.effect_es, str(base.effect_es));

    onSave(patch);
  }

  return (
    <div className="rounded-xl2 bg-panel p-4 shadow-card animate-fadein">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("editor.fields.nameEs")} htmlFor="af-name-es" modified={isModified("name_es")}
          modifiedLabel={t("editor.modified")} error={errors.name_es}>
          <input id="af-name-es" className={inputClass} value={draft.name_es}
            onChange={(e) => set("name_es", e.target.value)} />
        </Field>

        <Field label={t("editor.fields.nameEn")} htmlFor="af-name-en" modified={isModified("name_en")}
          modifiedLabel={t("editor.modified")} error={errors.name_en}>
          <input id="af-name-en" className={inputClass} value={draft.name_en}
            onChange={(e) => set("name_en", e.target.value)} />
        </Field>

        <Field label={t("editor.fields.generation")} htmlFor="af-gen" modified={isModified("generation")}
          modifiedLabel={t("editor.modified")} error={errors.generation}>
          <input id="af-gen" type="number" min={1} max={9} inputMode="numeric" className={inputClass}
            value={draft.generation} onChange={(e) => set("generation", e.target.value)} />
        </Field>

        <Field className="sm:col-span-2" label={t("editor.fields.effect")} htmlFor="af-effect"
          modified={isModified("effect_es")} modifiedLabel={t("editor.modified")}>
          <textarea id="af-effect" rows={4} className={inputClass} value={draft.effect_es}
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
