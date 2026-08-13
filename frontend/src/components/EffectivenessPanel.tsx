/**
 * PamuDeX — panel de efectividad.
 * Fase 1, desacoplado de los valores numéricos en la Tarea 6.2.
 *
 * SE INDEXA POR `key`, NO POR EL MULTIPLICADOR
 * --------------------------------------------
 * Antes la etiqueta y el color salían de tablas indexadas por el número
 * (`ACCENT[4]`, `LABEL_KEY[2]`). Eso deja de funcionar en cuanto el modo
 * Champions redefine los valores: un conjunto de reglas con «hiper eficaz» a x3
 * pintaría el grupo sin etiqueta y sin color.
 *
 * `key` es un valor canónico del proyecto (`hiper_eficaz`, `super_eficaz`,
 * `normal`, `poco_eficaz`, `muy_poco_eficaz`, `sin_efecto`) y no cambia nunca:
 * lo que cambia es el número que lo acompaña. El backend ya manda las dos cosas
 * en cada grupo, así que aquí solo hay que leerlas.
 */

import { EffectivenessBucket, PokeType } from "../types";
import { TypeBadge } from "./TypeBadge";
import { useI18n } from "../i18n";

/** Clave canónica -> clave de i18n. */
const LABEL_KEY: Record<string, string> = {
  hiper_eficaz: "effectiveness.hiper_eficaz",
  super_eficaz: "effectiveness.super_eficaz",
  normal: "effectiveness.normal",
  poco_eficaz: "effectiveness.poco_eficaz",
  muy_poco_eficaz: "effectiveness.muy_poco_eficaz",
  sin_efecto: "effectiveness.sin_efecto",
};

const ACCENT: Record<string, string> = {
  hiper_eficaz: "border-l-4 border-l-[#F08030]",
  super_eficaz: "border-l-4 border-l-[#C03028]",
  normal: "border-l-4 border-l-[#1C3350]",
  poco_eficaz: "border-l-4 border-l-[#A9BDD2]",
  muy_poco_eficaz: "border-l-4 border-l-[#6890F0]",
  sin_efecto: "border-l-4 border-l-[#705848]",
};

export function EffectivenessPanel({
  buckets,
  typesById,
}: {
  buckets: EffectivenessBucket[];
  typesById: Record<string, PokeType>;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {buckets
        // El grupo neutro no se pinta. Se filtra por la CLAVE y no por
        // `multiplier !== 1`: en un modo con multiplicadores propios, «normal»
        // puede no valer 1.
        .filter((b) => b.key !== "normal")
        .map((b) => (
          <div
            key={b.key}
            className={`panel-surface bg-panel rounded-xl2 p-4 ${ACCENT[b.key] ?? ""} animate-fadein`}
          >
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-mono text-lg font-bold text-ink">x{b.multiplier}</span>
              <span className="text-xs font-display tracking-widest text-ink-soft">
                {/* Si algún día llega una clave desconocida, se enseña la
                    etiqueta que manda el backend en vez de un hueco. */}
                {LABEL_KEY[b.key] ? t(LABEL_KEY[b.key]) : b.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {b.types.map((tid) => typesById[tid] && <TypeBadge key={tid} type={typesById[tid]} size="sm" />)}
            </div>
          </div>
        ))}
    </div>
  );
}
