import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { MoveDetail as MoveDetailT } from "../types";
import { FavoriteButton } from "../components/FavoriteButton";
import { NotAllowed } from "../components/NotAllowed";
import { useRecordVisit } from "../lib/history";
import { useI18n } from "../i18n";

export function MoveDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const [move, setMove] = useState<MoveDetailT | null>(null);
  // En modo Champions el backend responde 404 si la entidad no es legal.
  const [noPermitido, setNoPermitido] = useState(false);

  useEffect(() => {
    if (!id) return;
    setNoPermitido(false);
    api.moves.detail(id).then(setMove).catch(() => setNoPermitido(true));
  }, [id]);

  useRecordVisit("move", move ? move.id : undefined);

  if (noPermitido) return <NotAllowed />;
  if (!move) return <div className="max-w-2xl mx-auto px-4 py-10 text-ink-soft">Cargando...</div>;

  const rows: [string, string | number][] = [
    [t("move.category"), t(`category.${move.category}`)],
    [t("move.power"), move.power ?? "—"],
    [t("move.accuracy"), move.accuracy ? `${move.accuracy}%` : "—"],
    [t("move.pp"), move.pp],
    [t("move.priority"), move.priority],
    // null = desconocido (los movimientos importados de PokeAPI, que no expone
    // este dato). Se muestra «—» igual que potencia y precisión sin valor, en
    // vez de afirmar un «No» que no sabemos si es cierto.
    [t("move.contact"), move.makes_contact === null ? "—" : move.makes_contact ? t("yes") : t("no")],
    [t("pokemon.generation"), move.generation],
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-panel rounded-xl2 p-6 shadow-card animate-fadein">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: move.color }} />
          <h1 className="font-display text-2xl font-bold text-ink">{move.name_es}</h1>
          <span className="ml-auto"><FavoriteButton type="move" entityRef={move.id} /></span>
        </div>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6">
          {rows.map(([label, val]) => (
            <div key={label} className="flex justify-between border-b border-hover pb-2">
              <span className="text-ink-soft text-sm">{label}</span>
              <span className="text-ink font-medium text-sm">{val}</span>
            </div>
          ))}
        </div>
        <p className="text-ink-soft text-sm mt-4">{move.effect_es}</p>
      </div>
    </div>
  );
}
