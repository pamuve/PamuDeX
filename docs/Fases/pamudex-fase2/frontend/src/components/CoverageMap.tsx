import { CoverageReport, PokeType } from "../types";
import { TypeBadge } from "./TypeBadge";
import { useI18n } from "../i18n";

function Section({
  title,
  typeIds,
  typesById,
  accent,
}: {
  title: string;
  typeIds: string[];
  typesById: Record<string, PokeType>;
  accent: string;
}) {
  const { t } = useI18n();
  return (
    <div className={`bg-panel rounded-xl2 p-4 shadow-card animate-fadein border-l-4 ${accent}`}>
      <div className="text-xs uppercase tracking-widest text-ink-soft mb-2">{title}</div>
      {typeIds.length === 0 ? (
        <span className="text-sm text-ink-soft">{t("coverage.none_found")}</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {typeIds.map((id) => typesById[id] && <TypeBadge key={id} type={typesById[id]} size="sm" />)}
        </div>
      )}
    </div>
  );
}

export function CoverageMap({ report, typesById }: { report: CoverageReport; typesById: Record<string, PokeType> }) {
  const { t } = useI18n();
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Section title={t("coverage.global_weakness")} typeIds={report.globalWeakness} typesById={typesById} accent="border-l-[#C03028]" />
      <Section title={t("coverage.no_resist")} typeIds={report.noResist} typesById={typesById} accent="border-l-[#F08030]" />
      <Section title={t("coverage.overrepresented")} typeIds={report.overrepresented} typesById={typesById} accent="border-l-[#6890F0]" />
      <Section title={t("coverage.offensive")} typeIds={report.offensiveGaps} typesById={typesById} accent="border-l-[#A9BDD2]" />
      <Section title={t("coverage.defensive")} typeIds={report.defensiveHotspots} typesById={typesById} accent="border-l-[#705898]" />
    </div>
  );
}
