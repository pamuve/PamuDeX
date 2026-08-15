/**
 * PamuDeX — Tarea 7.1
 * Selector de generación de una ficha.
 *
 * SOLO SE PINTA SI HAY DIFERENCIAS REALES
 * ---------------------------------------
 * `has_generational_differences` lo calcula el backend por entidad
 * (`middleware/generationMode.js`). La inmensa mayoría de las 1.025 fichas no ha
 * cambiado nunca, y un desplegable de nueve generaciones que siempre enseña lo
 * mismo es ruido. Si el indicador no viene o es `false`, este componente
 * devuelve `null` y la ficha queda exactamente como antes de la Fase 7.
 *
 * `null` = «TODAS LAS GENERACIONES», y es el valor por defecto (Tarea 7.2). La
 * ficha se pide sin `?gen`, así que la respuesta trae los valores ACTUALES —
 * que son los que mandan— y encima se pintan las etiquetas `ChangeTag` con lo
 * que cambió por el camino.
 *
 * En la 7.1 esta opción se llamaba «Actual». No se añadió una opción aparte
 * porque serían la misma petición y los mismos datos: la única diferencia sería
 * ocultar las anotaciones, y una vista «como hoy pero sin contarte que cambió»
 * no le sirve a nadie. Elegir una generación concreta sí desactiva las
 * etiquetas: allí el dato YA es el histórico.
 *
 * Tampoco se pide `?gen=9` para decir «la actual»: sería una segunda entrada de
 * caché del Service Worker con exactamente el mismo contenido.
 */

import { useState } from "react";
import { useI18n } from "../i18n";

/** Generaciones que existen hoy. Debe cuadrar con CURRENT_GENERATION del backend. */
export const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * Estado del selector para una ficha, con la vuelta a «actual» al cambiar de
 * entidad: la generación elegida no tiene por qué significar nada en la ficha
 * siguiente, que puede no tener ni cambios registrados.
 *
 * EL RESETEO VA EN EL RENDER, NO EN UN `useEffect`
 * ------------------------------------------------
 * Con `useEffect(() => setGen(null), [id])` el reseteo ocurre DESPUÉS del
 * render, así que el efecto que carga la ficha corre en esa misma pasada con la
 * generación anterior todavía en la clausura: se pide `/pokemon/1?gen=5`, se
 * descarta y se vuelve a pedir sin `?gen`. Y si la primera respuesta llega la
 * última, la ficha se queda pintada con datos históricos y sin selector que lo
 * explique.
 *
 * Ajustar el estado durante el render es el patrón que documenta React para
 * esto: la pasada se descarta antes de tocar el DOM y los efectos ya ven el
 * valor nuevo.
 */
export function useGenerationView(entityKey: string | number | undefined) {
  const [gen, setGen] = useState<number | null>(null);
  const [anterior, setAnterior] = useState(entityKey);

  if (entityKey !== anterior) {
    setAnterior(entityKey);
    setGen(null);
  }

  return [gen, setGen] as const;
}

interface GenerationSelectorProps {
  /** `has_generational_differences` de la ficha. Sin él no se pinta nada. */
  visible: boolean | undefined;
  /** Generación seleccionada; `null` es la actual. */
  value: number | null;
  onChange: (gen: number | null) => void;
}

export function GenerationSelector({ visible, value, onChange }: GenerationSelectorProps) {
  const { t } = useI18n();

  if (!visible) return null;

  // «Todas» en el botón para que quepa junto a las nueve generaciones en 4";
  // el nombre completo va en el `aria-label`, que es lo que se lee en voz alta.
  const opciones: { key: string; label: string; titulo: string; gen: number | null }[] = [
    { key: "todas", label: t("generations.allShort"), titulo: t("generations.all"), gen: null },
    ...GENERATIONS.map((n) => ({
      key: String(n),
      label: String(n),
      titulo: t("generations.gen", { n }),
      gen: n as number | null,
    })),
  ];

  return (
    <div className="bg-panel rounded-xl2 p-4 shadow-card animate-fadein">
      <div
        role="group"
        aria-label={t("generations.label")}
        className="flex items-center gap-3 flex-wrap sm:flex-nowrap"
      >
        <span className="font-display text-xs tracking-widest text-ink-soft uppercase shrink-0">
          {t("generations.label")}
        </span>
        {/*
          Fila desplazable en horizontal: en 4" no caben diez botones, y
          envolverlos en dos líneas descoloca la cabecera de la ficha.
        */}
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 py-0.5">
          {opciones.map((o) => {
            const activo = o.gen === value;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => onChange(o.gen)}
                aria-pressed={activo}
                aria-label={o.titulo}
                title={o.titulo}
                className={`shrink-0 min-w-[2.25rem] px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activo
                    ? "bg-hover text-ink ring-1 ring-inset ring-[color:var(--color-ink-soft)]"
                    : "text-ink-soft hover:bg-hover hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-ink-soft mt-2">
        {value === null ? t("generations.allHint") : t("generations.viewing", { n: value })}
      </p>
    </div>
  );
}
