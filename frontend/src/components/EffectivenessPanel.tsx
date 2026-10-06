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

/**
 * Color del indicador de cada grupo, por intensidad: cuanto más pega, más
 * caliente. Antes x4 iba en naranja y x2 en rojo, al revés de lo que se lee.
 * Son tokens de estado (`theme-vars.css`), así que el alto contraste los aclara.
 */
const ACCENT: Record<string, string> = {
  hiper_eficaz: "bg-danger",
  super_eficaz: "bg-warning",
  normal: "bg-hover",
  poco_eficaz: "bg-success/60",
  muy_poco_eficaz: "bg-success",
  sin_efecto: "bg-ink-soft opacity-40",
};

export function EffectivenessPanel({
  buckets,
  typesById,
}: {
  buckets: EffectivenessBucket[];
  typesById: Record<string, PokeType>;
}) {
  const { t } = useI18n();
  // El grupo neutro no se pinta. Se filtra por la CLAVE y no por
  // `multiplier !== 1`: en un modo con multiplicadores propios, «normal» puede
  // no valer 1.
  const visibles = buckets.filter((b) => b.key !== "normal");
  if (visibles.length === 0) return null;

  // Una sola tarjeta con filas en vez de una tarjeta por grupo: son datos de
  // la misma tabla, y cinco cajas apiladas ocupaban el doble sin decir más.
  return (
    <ul className="card divide-y divide-hover !py-1 animate-fadein">
      {visibles.map((b) => (
        <li key={b.key} className="flex flex-col gap-2 py-3">
          <div className="flex items-center gap-2.5">
            <span className={`h-5 w-1 shrink-0 rounded-full ${ACCENT[b.key] ?? "bg-hover"}`} aria-hidden="true" />
            <span className="font-mono text-base font-bold text-ink tabular-nums">x{b.multiplier}</span>
            <span className="text-xs text-ink-soft">
              {/* Si algún día llega una clave desconocida, se enseña la
                  etiqueta que manda el backend en vez de un hueco. */}
              {LABEL_KEY[b.key] ? t(LABEL_KEY[b.key]) : b.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {b.types.map((tid) => typesById[tid] && <TypeBadge key={tid} type={typesById[tid]} size="sm" />)}
          </div>
        </li>
      ))}
    </ul>
  );
}
