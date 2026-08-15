/**
 * PamuDeX — Tarea 7.2
 * Etiqueta pequeña junto a un campo que cambió entre generaciones.
 *
 * REGLA DE DISEÑO DE LA FASE: EL VALOR ACTUAL MANDA
 * -------------------------------------------------
 * Lo histórico es una anotación, no puede competir visualmente con el dato
 * principal. De ahí que la etiqueta sea un icono de 12px en color secundario y
 * que el detalle solo aparezca al pedirlo.
 *
 * FUNCIONA POR PULSACIÓN, NO SOLO CON `hover`
 * -------------------------------------------
 * Requisito explícito del encargo: en móvil no hay ratón. El detalle se abre al
 * pulsar (y con Enter o Espacio, que disparan `click`), y además al pasar el
 * ratón. El `hover` se filtra con `pointerType === "mouse"`: sin ese filtro, en
 * pantallas táctiles el toque emula un `mouseenter` que abre el globo justo
 * antes de que el `click` lo cierre, y la etiqueta parece no responder.
 *
 * Si no hay ningún cambio para ese campo no se pinta nada, así que un campo sin
 * historial queda exactamente como antes de la Fase 7.
 */

import { useState } from "react";
import { History } from "lucide-react";
import { GenerationalChange } from "../types";
import { useI18n } from "../i18n";

/** Cómo leer un valor histórico. Por defecto se pinta tal cual. */
export type ValueFormatter = (value: unknown, change: GenerationalChange) => string;

interface ChangeTagProps {
  /**
   * Cambios de la entidad completa. Las páginas pasan `undefined` cuando se
   * está viendo una generación concreta: allí el dato YA es el histórico y
   * anotarlo otra vez sobraría.
   */
  changes: GenerationalChange[] | undefined;
  /** Campo exacto que anota esta etiqueta (`power`, `types`, `stats.atk`…). */
  field?: string;
  /** Alternativa a `field`: todos los campos que empiecen así (`relation:`). */
  prefix?: string;
  format?: ValueFormatter;
}

const porDefecto: ValueFormatter = (value) => (value === null || value === undefined ? "—" : String(value));

export function ChangeTag({ changes, field, prefix, format = porDefecto }: ChangeTagProps) {
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);

  const propios = (changes || []).filter(
    (c) => (field !== undefined && c.field === field) || (prefix !== undefined && c.field.startsWith(prefix))
  );
  if (!propios.length) return null;

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-expanded={abierto}
        aria-label={t("generations.changedLabel")}
        onClick={() => setAbierto((v) => !v)}
        onPointerEnter={(e) => e.pointerType === "mouse" && setAbierto(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setAbierto(false)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={(e) => e.key === "Escape" && setAbierto(false)}
        className="p-1 rounded-md text-ink-soft hover:text-ink hover:bg-hover transition-colors"
      >
        <History size={12} aria-hidden="true" />
      </button>

      {abierto && (
        <span
          role="tooltip"
          className="absolute z-20 left-0 top-full mt-1 w-56 max-w-[70vw] rounded-lg bg-hover text-ink shadow-card p-2.5 text-xs font-normal normal-case tracking-normal text-left space-y-1.5"
        >
          {propios.map((c, i) => (
            <span key={`${c.generation}-${c.field}-${i}`} className="block">
              {t("generations.was", { gen: c.generation, value: format(c.old_value, c) })}
              {c.note && <span className="block text-ink-soft mt-0.5">{c.note}</span>}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
