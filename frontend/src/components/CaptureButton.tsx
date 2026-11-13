import { useState } from "react";
import { PokeballIcon } from "./PokeballIcon";
import { useCaptures } from "../lib/captures";
import { useI18n } from "../i18n";

/**
 * Botón «Capturado» de la ficha (Fase 9). Es un conmutador: `aria-pressed` dice
 * el estado, y además cambian el texto, el relleno de la Poké Ball y el fondo,
 * para que no dependa solo del color.
 *
 * La captura es del perfil Y del juego activo (`lib/scope.ts`): la misma ficha
 * puede estar capturada en un ROM Hack y no en otro.
 */
export function CaptureButton({ pokemonId }: { pokemonId: number }) {
  const { t } = useI18n();
  const captures = useCaptures();
  const [fallo, setFallo] = useState(false);

  if (!captures.enabled) return null;
  const capturado = captures.isCaptured(pokemonId);

  async function alternar() {
    setFallo(false);
    if (!capturado) navigator.vibrate?.(10);
    try {
      await captures.toggle(pokemonId);
    } catch {
      setFallo(true);
      window.setTimeout(() => setFallo(false), 2500);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        aria-pressed={capturado}
        disabled={!captures.ready}
        className={`pressable inline-flex min-h-[2.75rem] items-center gap-2 rounded-full px-4 text-sm font-medium
                    transition-colors disabled:opacity-50 ${
                      capturado
                        ? "bg-success/15 text-success ring-1 ring-success/40"
                        : "bg-hover text-ink-soft hover:text-ink"
                    }`}
      >
        <PokeballIcon size={18} filled={capturado} />
        {capturado ? t("captures.captured") : t("captures.notCaptured")}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {fallo ? t("captures.toggleError") : ""}
      </span>
    </>
  );
}
