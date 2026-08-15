import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { TypeDetail as TypeDetailT, PokeType } from "../types";
import { TypeBadge } from "../components/TypeBadge";
import { EffectivenessPanel } from "../components/EffectivenessPanel";
import { FavoriteButton } from "../components/FavoriteButton";
import { GenerationSelector, useGenerationView } from "../components/GenerationSelector";
import { ChangeTag } from "../components/ChangeTag";
import { ChangeHistory } from "../components/ChangeHistory";
import { RELATION_IN, RELATION_OUT, otherTypeOf, makeChangeLine } from "../lib/generations";
import { useRecordVisit } from "../lib/history";
import { useI18n } from "../i18n";

export function TypeDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const [type, setType] = useState<TypeDetailT | null>(null);
  const [typesById, setTypesById] = useState<Record<string, PokeType>>({});
  // Generación que se está viendo; null = la actual (Fase 7).
  const [gen, setGen] = useGenerationView(id);

  useEffect(() => {
    if (!id) return;
    // Ver PokemonDetail: descarta la respuesta de una generación ya no elegida.
    let cancelado = false;
    api.types.detail(id, gen).then((tp) => !cancelado && setType(tp));
    return () => {
      cancelado = true;
    };
  }, [id, gen]);

  // El listado es solo para pintar nombres y colores en los paneles: se pide
  // una vez y no depende de la generación.
  useEffect(() => {
    api.types.list().then((list) => setTypesById(Object.fromEntries(list.map((t) => [t.id, t]))));
  }, []);

  useRecordVisit("type", type ? type.id : undefined);

  if (!type) return <div className="max-w-3xl mx-auto px-4 py-10 text-ink-soft">Cargando...</div>;

  // Las etiquetas solo tienen sentido en «Todas las generaciones» (ver
  // PokemonDetail).
  const cambios = gen === null ? type.generational_changes : undefined;

  /**
   * Un cambio de relación se lee nombrando al otro tipo: «x0.5 contra Acero» en
   * el panel ofensivo, «x0.5 frente a Fantasma» en el defensivo. Sin el otro
   * tipo, el multiplicador suelto no diría nada.
   */
  const relacion = (value: unknown, change: { field: string }) => {
    const otro = otherTypeOf(change.field);
    const nombre = otro ? typesById[otro]?.name_es ?? otro : "";
    const mult = `x${value}`;
    if (!otro) return mult;
    return change.field.startsWith(RELATION_OUT)
      ? t("generations.against", { value: mult, type: nombre })
      : t("generations.from", { value: mult, type: nombre });
  };

  // En la línea temporal el otro tipo va en la ETIQUETA del campo («Contra
  // Acero: x0.5 → x1»), no repetido en los dos valores.
  const linea = makeChangeLine(
    t,
    (field) => {
      const otro = otherTypeOf(field);
      if (!otro) return field;
      const nombre = typesById[otro]?.name_es ?? otro;
      return field.startsWith(RELATION_OUT)
        ? t("generations.field.offense", { type: nombre })
        : t("generations.field.defense", { type: nombre });
    },
    (value) => `x${value}`
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* El distintivo hace de título de la ficha, así que va dentro de un `h1`
          (8.2): era la única página sin encabezado de nivel 1 y empezaba
          directamente en `h2`, lo que rompe el índice del lector de pantalla. */}
      <div className="flex justify-center items-center gap-1">
        <h1 className="flex">
          <TypeBadge type={type} size="lg" />
        </h1>
        <FavoriteButton type="type" entityRef={type.id} />
      </div>

      <GenerationSelector
        visible={type.has_generational_differences}
        value={gen}
        onChange={setGen}
      />

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-4">
            {t("type.offensive")}
            <ChangeTag changes={cambios} prefix={RELATION_OUT} format={relacion} />
          </h2>
          <EffectivenessPanel buckets={type.ofensivo} typesById={typesById} />
        </div>
        <div>
          <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-4">
            {t("type.defensive")}
            <ChangeTag changes={cambios} prefix={RELATION_IN} format={relacion} />
          </h2>
          <EffectivenessPanel buckets={type.defensivo} typesById={typesById} />
        </div>
      </div>

      <ChangeHistory changes={type.generational_changes} line={linea} />
    </div>
  );
}
