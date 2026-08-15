/**
 * PamuDeX — Fase 7, lado del frontend.
 *
 * Los cambios de la tabla de tipos se anotan SIEMPRE en el tipo defensor
 * (`backend/lib/generations.js`). Para que la ficha de un tipo pueda enseñar los
 * dos lados, el backend devuelve:
 *
 *  - `relation:<atacante>`      — el tipo de la ficha es el DEFENSOR; el cambio
 *                                 afecta a su panel «Defensivo».
 *  - `relation_out:<defensor>`  — el tipo de la ficha es el ATACANTE. Es un
 *                                 prefijo sintético: en la base no existe, lo
 *                                 sintetiza `changesFor` a partir de las filas
 *                                 anotadas en el otro tipo. Afecta a su panel
 *                                 «Ofensivo».
 *
 * OJO con el orden al comprobar prefijos: `"relation_out:acero"` NO empieza por
 * `"relation:"`, pero sí comparte las ocho primeras letras, así que conviene
 * usar estas constantes y no escribirlas a mano en cada sitio.
 */

import { GenerationalChange } from "../types";

/** El tipo de la ficha es el defensor: afecta a su panel «Defensivo». */
export const RELATION_IN = "relation:";

/** El tipo de la ficha es el atacante: afecta a su panel «Ofensivo». */
export const RELATION_OUT = "relation_out:";

/** Id del otro tipo implicado en un cambio de relación, o null si no lo es. */
export function otherTypeOf(field: string): string | null {
  if (field.startsWith(RELATION_OUT)) return field.slice(RELATION_OUT.length);
  if (field.startsWith(RELATION_IN)) return field.slice(RELATION_IN.length);
  return null;
}

/**
 * Arma la frase de una línea del historial (Tarea 7.3): «Potencia: 95 → 90».
 *
 * Una sola plantilla para todos los campos en vez de una frase por campo. Con
 * plantillas por campo harían falta decenas de claves i18n y cada campo nuevo
 * del dataset obligaría a inventar otra; así basta con saber cómo se llama el
 * campo y cómo se lee su valor, que es justo lo que cada ficha ya sabe hacer
 * para sus `ChangeTag`.
 */
export function makeChangeLine(
  t: (key: string, params?: Record<string, string | number>) => string,
  fieldLabel: (field: string) => string,
  formatValue: (value: unknown, change: GenerationalChange) => string
): (change: GenerationalChange) => string {
  return (change) =>
    t("generations.line", {
      field: fieldLabel(change.field),
      from: formatValue(change.old_value, change),
      to: formatValue(change.new_value, change),
    });
}
