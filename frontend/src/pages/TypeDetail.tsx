import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { TypeDetail as TypeDetailT, PokeType } from "../types";
import { TypeBadge } from "../components/TypeBadge";
import { EffectivenessPanel } from "../components/EffectivenessPanel";
import { useI18n } from "../i18n";

export function TypeDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const [type, setType] = useState<TypeDetailT | null>(null);
  const [typesById, setTypesById] = useState<Record<string, PokeType>>({});

  useEffect(() => {
    if (!id) return;
    api.types.detail(id).then(setType);
    api.types.list().then((list) => setTypesById(Object.fromEntries(list.map((t) => [t.id, t]))));
  }, [id]);

  if (!type) return <div className="max-w-3xl mx-auto px-4 py-10 text-ink-soft">Cargando...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-center">
        <TypeBadge type={type} size="lg" />
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-4">{t("type.offensive")}</h2>
          <EffectivenessPanel buckets={type.ofensivo} typesById={typesById} />
        </div>
        <div>
          <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-4">{t("type.defensive")}</h2>
          <EffectivenessPanel buckets={type.defensivo} typesById={typesById} />
        </div>
      </div>
    </div>
  );
}