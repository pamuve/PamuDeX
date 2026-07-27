import { EffectivenessBucket, PokeType } from "../types";
import { TypeBadge } from "./TypeBadge";
import { useI18n } from "../i18n";

const LABEL_KEY: Record<number, string> = {
  4: "effectiveness.x4",
  2: "effectiveness.x2",
  1: "effectiveness.x1",
  0.5: "effectiveness.x05",
  0.25: "effectiveness.x025",
  0: "effectiveness.x0",
};

const ACCENT: Record<number, string> = {
  4: "border-l-4 border-l-[#F08030]",
  2: "border-l-4 border-l-[#C03028]",
  1: "border-l-4 border-l-[#1C3350]",
  0.5: "border-l-4 border-l-[#A9BDD2]",
  0.25: "border-l-4 border-l-[#6890F0]",
  0: "border-l-4 border-l-[#705848]",
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
        .filter((b) => b.multiplier !== 1)
        .map((b) => (
          <div key={b.key} className={`panel-surface bg-panel rounded-xl2 p-4 ${ACCENT[b.multiplier] ?? ""} animate-fadein`}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-mono text-lg font-bold text-ink">x{b.multiplier}</span>
              <span className="text-xs font-display tracking-widest text-ink-soft">{t(LABEL_KEY[b.multiplier] ?? "")}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {b.types.map((tid) => typesById[tid] && <TypeBadge key={tid} type={typesById[tid]} size="sm" />)}
            </div>
          </div>
        ))}
    </div>
  );
}