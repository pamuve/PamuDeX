/**
 * PamuDeX — Tarea 3.4
 * Formulario visual de un tipo: nombre es/en y color oficial.
 */

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, Loader2 } from "lucide-react";
import type { TypeMeta } from "../../lib/apiSession";
import type { EntityPatch } from "../../hooks/useSessionOverride";
import { Field, inputClass, btnGhost, btnPrimary } from "./FormField";

interface Props {
  base: TypeMeta;
  override: EntityPatch;
  saving: boolean;
  t: (key: string, params?: Record<string, string>) => string;
  onSave: (patch: EntityPatch) => void | Promise<void>;
  onReset: () => void | Promise<void>;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export default function TypeForm({ base, override, saving, t, onSave, onReset }: Props) {
  const merged = useMemo(() => ({ ...base, ...override }), [base, override]);

  const [nameEs, setNameEs] = useState(String(merged.name_es ?? ""));
  const [nameEn, setNameEn] = useState(String(merged.name_en ?? ""));
  const [color, setColor] = useState(String(merged.color ?? "#132238"));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setNameEs(String(merged.name_es ?? ""));
    setNameEn(String(merged.name_en ?? ""));
    setColor(String(merged.color ?? "#132238"));
    setErrors({});
  }, [merged]);

  const isModified = (field: string) => Object.prototype.hasOwnProperty.call(override, field);

  function handleSubmit() {
    const found: Record<string, string> = {};
    if (!nameEs.trim()) found.name_es = t("editor.error.required");
    if (!nameEn.trim()) found.name_en = t("editor.error.required");
    if (!HEX.test(color)) found.color = t("editor.error.hex");
    setErrors(found);
    if (Object.keys(found).length) return;

    const patch: EntityPatch = {};
    const compare = (field: string, value: unknown, baseValue: unknown) => {
      if (value !== baseValue) patch[field] = value;
      else if (isModified(field)) patch[field] = undefined;
    };
    compare("name_es", nameEs.trim(), base.name_es);
    compare("name_en", nameEn.trim(), base.name_en);
    compare("color", color, base.color);
    onSave(patch);
  }

  return (
    <div className="rounded-xl2 bg-panel p-4 shadow-card animate-fadein">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("editor.fields.nameEs")} htmlFor="tf-name-es" modified={isModified("name_es")}
          modifiedLabel={t("editor.modified")} error={errors.name_es}>
          <input id="tf-name-es" className={inputClass} value={nameEs}
            onChange={(e) => setNameEs(e.target.value)} />
        </Field>

        <Field label={t("editor.fields.nameEn")} htmlFor="tf-name-en" modified={isModified("name_en")}
          modifiedLabel={t("editor.modified")} error={errors.name_en}>
          <input id="tf-name-en" className={inputClass} value={nameEn}
            onChange={(e) => setNameEn(e.target.value)} />
        </Field>

        <Field className="sm:col-span-2" label={t("editor.fields.color")} htmlFor="tf-color"
          modified={isModified("color")} modifiedLabel={t("editor.modified")} error={errors.color}>
          <div className="flex items-center gap-3">
            <input id="tf-color" type="color" value={HEX.test(color) ? color : "#132238"}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-hover bg-base" />
            <input aria-label={t("editor.fields.color")} className={inputClass} value={color}
              onChange={(e) => setColor(e.target.value)} />
            <span className="hidden shrink-0 rounded-full px-3 py-1 text-xs font-medium sm:inline"
              style={{ backgroundColor: HEX.test(color) ? color : "#132238", color: "#0A1425" }}>
              {nameEs || "—"}
            </span>
          </div>
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
