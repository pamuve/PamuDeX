/**
 * PamuDeX — Tarea 5.2
 * Teclado numérico para el PIN de perfil.
 *
 * Táctil primero: es lo que se usa en el sofá con el móvil o en la Steam Deck.
 * Las teclas son de 64px, muy por encima del mínimo de 44px, y no se depende
 * del teclado físico — aunque también funciona, porque en escritorio es lo
 * natural (y `inputMode` no sirve aquí: no hay <input>, para que el navegador
 * no ofrezca guardar el PIN como si fuera una contraseña de sitio web).
 */

import { useEffect } from "react";
import { Delete } from "lucide-react";
import { useI18n } from "../i18n";

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  length: number;
  /** Se llama al completar la longitud. Evita tener que pulsar "aceptar". */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  /** Marca los puntos en rojo tras un fallo. */
  error?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function PinPad({ value, onChange, length, onComplete, disabled, error }: PinPadProps) {
  const { t } = useI18n();

  function push(digit: string) {
    if (disabled || value.length >= length) return;
    const next = value + digit;
    onChange(next);
    if (next.length === length && onComplete) onComplete(next);
  }

  function back() {
    if (disabled) return;
    onChange(value.slice(0, -1));
  }

  // El teclado físico también vale: en escritorio es lo que uno espera.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (disabled) return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        push(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        back();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Puntos: cuántos dígitos llevas, sin mostrar cuáles */}
      <div className="flex gap-3" role="status" aria-label={t("pin.entered", { n: String(value.length), total: String(length) })}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-colors ${
              error
                ? "bg-[#F85888]"
                : i < value.length
                  ? "bg-ink"
                  : "bg-hover"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => push(key)}
            disabled={disabled}
            className="w-16 h-16 rounded-full bg-panel text-ink text-xl font-display font-bold hover:bg-hover active:scale-95 transition disabled:opacity-40"
          >
            {key}
          </button>
        ))}
        {/* Hueco vacío para que el 0 quede centrado, como en un teclado de teléfono */}
        <span aria-hidden="true" />
        <button
          type="button"
          onClick={() => push("0")}
          disabled={disabled}
          className="w-16 h-16 rounded-full bg-panel text-ink text-xl font-display font-bold hover:bg-hover active:scale-95 transition disabled:opacity-40"
        >
          0
        </button>
        <button
          type="button"
          onClick={back}
          disabled={disabled || value.length === 0}
          aria-label={t("pin.backspace")}
          className="w-16 h-16 rounded-full text-ink-soft hover:bg-hover hover:text-ink active:scale-95 transition disabled:opacity-30 flex items-center justify-center"
        >
          <Delete size={22} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
