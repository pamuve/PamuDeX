import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { MoveDetail as MoveDetailT, PokeType } from "../types";
import { FavoriteButton } from "../components/FavoriteButton";
import { GenerationSelector, useGenerationView } from "../components/GenerationSelector";
import { ChangeTag } from "../components/ChangeTag";
import { ChangeHistory } from "../components/ChangeHistory";
import { makeChangeLine } from "../lib/generations";
import { NotAllowed } from "../components/NotAllowed";
import { useRecordVisit } from "../lib/history";
import { useI18n } from "../i18n";

export function MoveDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const [move, setMove] = useState<MoveDetailT | null>(null);
  // Solo para poder leer un tipo histórico por su nombre en las etiquetas de
  // cambios: el id que guarda `entity_changes` es canónico y sin tilde
  // ('psiquico'), y pintarlo en crudo quedaría mal en español.
  const [typesById, setTypesById] = useState<Record<string, PokeType>>({});
  // Generación que se está viendo; null = la actual (Fase 7).
  const [gen, setGen] = useGenerationView(id);
  // En modo Champions el backend responde 404 si la entidad no es legal.
  const [noPermitido, setNoPermitido] = useState(false);

  useEffect(() => {
    if (!id) return;
    setNoPermitido(false);
    // Ver PokemonDetail: descarta la respuesta de una generación ya no elegida.
    let cancelado = false;
    api.moves
      .detail(id, gen)
      .then((m) => !cancelado && setMove(m))
      .catch(() => !cancelado && setNoPermitido(true));
    return () => {
      cancelado = true;
    };
  }, [id, gen]);

  useEffect(() => {
    api.types.list().then((list) => setTypesById(Object.fromEntries(list.map((tp) => [tp.id, tp]))));
  }, []);

  useRecordVisit("move", move ? move.id : undefined);

  if (noPermitido) return <NotAllowed />;
  if (!move) return <div className="max-w-2xl mx-auto px-4 py-10 text-ink-soft">Cargando...</div>;

  // Las etiquetas solo tienen sentido en «Todas las generaciones» (ver
  // PokemonDetail).
  const cambios = gen === null ? move.generational_changes : undefined;

  /** Categorías y tipos se guardan como valor canónico; se traducen al leerlos. */
  const categoria = (value: unknown) => t(`category.${String(value)}`);
  const nombreDeTipo = (value: unknown) => typesById[String(value)]?.name_es ?? String(value);

  // Las etiquetas de campo son las mismas que las de la tabla de arriba, para
  // que la línea temporal se lea con el mismo vocabulario que la ficha.
  const ETIQUETA: Record<string, string> = {
    category: t("move.category"),
    power: t("move.power"),
    accuracy: t("move.accuracy"),
    pp: t("move.pp"),
    priority: t("move.priority"),
    makes_contact: t("move.contact"),
    type_id: t("generations.field.type"),
  };

  const linea = makeChangeLine(
    t,
    (field) => ETIQUETA[field] ?? field,
    (value, change) => {
      if (change.field === "category") return categoria(value);
      if (change.field === "type_id") return nombreDeTipo(value);
      if (change.field === "makes_contact") return value ? t("yes") : t("no");
      return String(value);
    }
  );

  // El tercer elemento es el campo de `entity_changes` que anota esa fila.
  const rows: [string, string | number, string?, ((v: unknown) => string)?][] = [
    [t("move.category"), t(`category.${move.category}`), "category", categoria],
    [t("move.power"), move.power ?? "—", "power"],
    [t("move.accuracy"), move.accuracy ? `${move.accuracy}%` : "—", "accuracy"],
    [t("move.pp"), move.pp, "pp"],
    [t("move.priority"), move.priority, "priority"],
    // null = desconocido (los movimientos importados de PokeAPI, que no expone
    // este dato). Se muestra «—» igual que potencia y precisión sin valor, en
    // vez de afirmar un «No» que no sabemos si es cierto.
    [t("move.contact"), move.makes_contact === null ? "—" : move.makes_contact ? t("yes") : t("no"), "makes_contact"],
    [t("pokemon.generation"), move.generation],
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-panel rounded-xl2 p-6 shadow-card animate-fadein">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: move.color }} />
          <h1 className="font-display text-2xl font-bold text-ink">{move.name_es}</h1>
          <ChangeTag changes={cambios} field="type_id" format={nombreDeTipo} />
          <span className="ml-auto"><FavoriteButton type="move" entityRef={move.id} /></span>
        </div>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6">
          {rows.map(([label, val, field, format]) => (
            <div key={label} className="flex justify-between border-b border-hover pb-2">
              <span className="text-ink-soft text-sm">
                {label}
                {field && <ChangeTag changes={cambios} field={field} format={format} />}
              </span>
              <span className="text-ink font-medium text-sm">{val}</span>
            </div>
          ))}
        </div>
        <p className="text-ink-soft text-sm mt-4">{move.effect_es}</p>
      </div>

      <GenerationSelector
        visible={move.has_generational_differences}
        value={gen}
        onChange={setGen}
      />

      <ChangeHistory changes={move.generational_changes} line={linea} />
    </div>
  );
}
