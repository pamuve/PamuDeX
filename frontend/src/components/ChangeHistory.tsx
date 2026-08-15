/**
 * PamuDeX — Tarea 7.3
 * Línea temporal vertical con todo lo que cambió en una entidad, agrupado por
 * generación. Colapsable y **cerrada por defecto**.
 *
 * NO PIDE NADA AL SERVIDOR
 * ------------------------
 * Los cambios ya vienen embebidos en la ficha desde la Tarea 7.2
 * (`generational_changes`), así que abrir el desplegable no cuesta una petición
 * y funciona sin conexión. La ruta `GET /api/changes/:tipo/:ref` existe para
 * consultar el historial sin cargar una ficha, no para esto.
 *
 * SIN CAMBIOS NO SE PINTA NADA, ni el título ni el desplegable vacío: es un
 * criterio explícito del encargo, y encaja con la regla de la fase de que lo
 * histórico no puede estorbar al dato actual.
 *
 * Complementa a `ChangeTag`, no lo repite: la etiqueta responde «¿qué le pasó a
 * ESTE campo?» junto al dato, y esta vista responde «¿qué le ha pasado a esta
 * entidad, en orden?» de una vez.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { GenerationalChange } from "../types";
import { useI18n } from "../i18n";

/** Cómo leer un cambio concreto. Devuelve la frase completa de la línea. */
export type ChangeLine = (change: GenerationalChange) => string;

interface ChangeHistoryProps {
  changes: GenerationalChange[] | undefined;
  /**
   * Traduce un cambio a una frase. Cada ficha sabe leer sus propios campos (un
   * array de ids de tipo, una categoría canónica, un multiplicador...), así que
   * la construye la página.
   */
  line: ChangeLine;
}

export function ChangeHistory({ changes, line }: ChangeHistoryProps) {
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);

  if (!changes || !changes.length) return null;

  // Agrupadas por generación, de la más antigua a la más nueva. El backend ya
  // las manda ordenadas; aquí solo se reparten en cubos conservando ese orden.
  const porGeneracion: { generation: number; items: GenerationalChange[] }[] = [];
  for (const c of changes) {
    const ultimo = porGeneracion[porGeneracion.length - 1];
    if (ultimo && ultimo.generation === c.generation) ultimo.items.push(c);
    else porGeneracion.push({ generation: c.generation, items: [c] });
  }

  return (
    <div className="bg-panel rounded-xl2 shadow-card animate-fadein overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="w-full flex items-center gap-2 p-4 text-left hover:bg-hover transition-colors"
      >
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`text-ink-soft transition-transform shrink-0 ${abierto ? "rotate-180" : ""}`}
        />
        <span className="font-display text-sm tracking-widest text-ink-soft uppercase">
          {t("generations.history")}
        </span>
        {/*
          Dos claves en vez de una: `i18n/index.tsx` sustituye parámetros y nada
          más, no sabe de plurales, y «1 cambios» está mal en los dos idiomas.
        */}
        <span className="ml-auto text-xs text-ink-soft shrink-0">
          {changes.length === 1
            ? t("generations.historyOne")
            : t("generations.historyMany", { n: changes.length })}
        </span>
      </button>

      {abierto && (
        <ol className="px-4 pb-4 space-y-4">
          {porGeneracion.map((grupo) => (
            <li key={grupo.generation} className="flex gap-3">
              {/*
                El eje vertical: un punto por generación y la línea que baja
                hasta la siguiente. `flex-1` hace que la línea llegue al final
                del bloque sea cual sea su alto.
              */}
              <div className="flex flex-col items-center shrink-0 pt-1">
                <span className="w-2 h-2 rounded-full bg-ink-soft shrink-0" />
                <span className="w-px flex-1 bg-hover mt-1" />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="font-display text-xs tracking-widest text-ink-soft uppercase mb-1">
                  {t("generations.gen", { n: grupo.generation })}
                </div>
                <ul className="space-y-1.5">
                  {grupo.items.map((c, i) => (
                    <li key={`${c.field}-${i}`} className="text-sm text-ink">
                      {line(c)}
                      {c.note && <span className="block text-xs text-ink-soft mt-0.5">{c.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
