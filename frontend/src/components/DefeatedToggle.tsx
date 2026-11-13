import { Skull } from "lucide-react";
import { useI18n } from "../i18n";

/**
 * «Derrotado» (Fase 9): marca un Pokémon del comparador como fuera de combate.
 *
 * No lo quita del equipo —el combate siguiente lo vuelve a necesitar con sus
 * movimientos y su objeto—, solo lo aparta de los consejos: uno propio
 * derrotado no se recomienda, y contra uno rival derrotado ya no se calcula
 * respuesta. Es un conmutador con texto, no solo un icono que cambia de color.
 */
export function DefeatedToggle({
  defeated,
  name,
  onChange,
}: {
  defeated: boolean;
  name: string;
  onChange: (defeated: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => onChange(!defeated)}
      aria-pressed={defeated}
      aria-label={t("team.defeatedNamed", { name })}
      className={`pressable inline-flex min-h-[2.5rem] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
        defeated ? "bg-danger/20 text-ink ring-1 ring-danger/50" : "bg-hover text-ink-soft hover:text-ink"
      }`}
    >
      <Skull size={15} aria-hidden="true" />
      {t("team.defeated")}
    </button>
  );
}
