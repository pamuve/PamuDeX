/**
 * PamuDeX — Tarea 5.2
 * Diálogo del PIN de perfil. Cubre los cuatro casos con el mismo cuerpo:
 *
 *   enter   — comprobar el PIN para entrar en el perfil
 *   set     — poner PIN nuevo            (nuevo -> repetir)
 *   change  — cambiar el PIN existente   (actual -> nuevo -> repetir)
 *   remove  — quitar el PIN              (actual)
 *
 * POR QUÉ SE PIDE REPETIR EL PIN AL PONERLO
 * -----------------------------------------
 * No hay ningún mecanismo de recuperación: si te equivocas al teclearlo, la
 * única salida es borrar el perfil, y eso se lleva por delante sus sesiones de
 * ROM Hack. El paso de confirmación es lo que evita quedarse fuera por una
 * errata. No lo quites sin poner antes una vía de recuperación.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { X, Loader2, ShieldAlert } from "lucide-react";
import { PinPad } from "./PinPad";
import { profilesApi, ApiError } from "../lib/apiSession";
import { PIN_LENGTH, type Profile } from "../lib/profile";
import { useI18n } from "../i18n";

export type PinMode = "enter" | "set" | "change" | "remove";

interface PinDialogProps {
  mode: PinMode;
  profile: Profile;
  onDone: (profile: Profile) => void;
  onCancel: () => void;
}

/** Pasos que pide cada modo, en orden. */
const STEPS: Record<PinMode, ("current" | "new" | "confirm")[]> = {
  enter: ["current"],
  set: ["new", "confirm"],
  change: ["current", "new", "confirm"],
  remove: ["current"],
};

export function PinDialog({ mode, profile, onDone, onCancel }: PinDialogProps) {
  const { t } = useI18n();
  const steps = STEPS[mode];

  const [stepIndex, setStepIndex] = useState(0);
  const [pin, setPin] = useState("");
  const [current, setCurrent] = useState("");
  const [firstNew, setFirstNew] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedFor, setLockedFor] = useState(0);

  const step = steps[stepIndex];
  const dialogRef = useRef<HTMLDivElement>(null);

  // Cuenta atrás mientras el límite de intentos tiene bloqueado el perfil.
  useEffect(() => {
    if (lockedFor <= 0) return;
    const timer = setTimeout(() => setLockedFor((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockedFor]);

  // Escape cierra, y el foco entra en el diálogo para que el teclado físico
  // llegue al PinPad sin tener que pinchar antes.
  useEffect(() => {
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  /** Traduce el código de error del backend a un mensaje. */
  function messageFor(err: unknown): string {
    const code = err instanceof Error ? err.message : "";
    if (code === "pin_incorrecto") return t("pin.wrong");
    if (code === "demasiados_intentos") return t("pin.tooMany");
    if (code === "pin_invalido") return t("pin.invalid");
    return t("pin.error");
  }

  /** Guarda el retry_after del backend para la cuenta atrás, si viene. */
  function applyLock(err: unknown) {
    if (err instanceof ApiError && typeof err.payload.retry_after === "number") {
      setLockedFor(err.payload.retry_after);
    }
  }

  async function handleComplete(entered: string) {
    setError(null);

    // Paso intermedio: guardar y avanzar sin llamar al servidor.
    if (step === "current" && steps.length > 1) {
      setCurrent(entered);
      setPin("");
      setStepIndex(stepIndex + 1);
      return;
    }
    if (step === "new") {
      setFirstNew(entered);
      setPin("");
      setStepIndex(stepIndex + 1);
      return;
    }
    if (step === "confirm" && entered !== firstNew) {
      // No coincide: se vuelve al paso del PIN nuevo, no al principio.
      setError(t("pin.mismatch"));
      setPin("");
      setStepIndex(steps.indexOf("new"));
      return;
    }

    setBusy(true);
    try {
      if (mode === "enter") {
        const res = await profilesApi.verifyPin(profile.id, entered);
        onDone(res.profile);
      } else if (mode === "remove") {
        const res = await profilesApi.removePin(profile.id, entered);
        onDone(res.profile);
      } else if (mode === "set") {
        const res = await profilesApi.setPin(profile.id, entered);
        onDone(res.profile);
      } else {
        const res = await profilesApi.setPin(profile.id, entered, current);
        onDone(res.profile);
      }
    } catch (err) {
      setError(messageFor(err));
      applyLock(err);
      setPin("");
      // Un fallo del servidor devuelve al primer paso: el PIN actual que
      // habíamos guardado ya no sirve de nada.
      setStepIndex(0);
      setCurrent("");
      setFirstNew("");
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<string, string> = {
    current: mode === "enter" ? t("pin.enterTitle") : t("pin.currentTitle"),
    new: t("pin.newTitle"),
    confirm: t("pin.confirmTitle"),
  };

  const blocked = busy || lockedFor > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-base/90 backdrop-blur-sm p-4 animate-fadein"
      role="dialog"
      aria-modal="true"
      aria-label={titles[step]}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-panel rounded-xl2 shadow-card p-5 w-full max-w-xs outline-none"
      >
        <div className="flex items-start gap-3 mb-4">
          <span
            className="color-chip w-10 h-10 rounded-full flex items-center justify-center font-display font-bold shrink-0"
            style={
              {
                backgroundColor: profile.color || "#7FB4E8",
                color: "#0A1425",
                "--chip-color": profile.color || "#7FB4E8",
              } as CSSProperties
            }
            aria-hidden="true"
          >
            {profile.avatar || profile.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink truncate">{profile.name}</p>
            <p className="text-xs text-ink-soft">{titles[step]}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label={t("pin.cancel")}
            className="p-1.5 rounded-lg text-ink-soft hover:text-ink hover:bg-hover transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <PinPad
          value={pin}
          onChange={setPin}
          length={PIN_LENGTH}
          onComplete={handleComplete}
          disabled={blocked}
          error={error !== null}
        />

        <div className="mt-4 min-h-[2.5rem] text-center">
          {busy && (
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {t("pin.checking")}
            </span>
          )}
          {!busy && lockedFor > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm text-ink">
              <ShieldAlert size={15} aria-hidden="true" />
              {t("pin.lockedFor", { s: String(lockedFor) })}
            </span>
          )}
          {!busy && lockedFor === 0 && error && (
            <span className="text-sm text-[#F85888]" role="alert">
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
