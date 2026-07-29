/**
 * PamuDeX — Tarea 3.3
 * Editor visual de Pokémon.
 *
 * Se exporta de dos formas:
 *  - `PokemonEditorPane`: el panel, que reutiliza la pestaña Pokémon de /editor.
 *  - por defecto: la página completa en /editor/pokemon.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { catalogApi, type PokemonDetail, type PokemonListItem, type TypeMeta } from "../lib/apiSession";
import {
  useSessionOverrides,
  useSessionOverride,
  type SessionOverrides,
} from "../hooks/useSessionOverride";
import { useI18n } from "../i18n";
import PokemonForm from "../components/forms/PokemonForm";
import EntityPicker from "../components/forms/EntityPicker";
import SessionRequired from "../components/SessionRequired";

interface I18nShape {
  t: (key: string, params?: Record<string, string>) => string;
  lang?: string;
}

export function PokemonEditorPane({ overrides }: { overrides: SessionOverrides }) {
  const { t, lang } = useI18n() as unknown as I18nShape;

  const [list, setList] = useState<PokemonListItem[]>([]);
  const [types, setTypes] = useState<TypeMeta[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PokemonDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { override, save, reset } = useSessionOverride(overrides, "pokemon", selectedId);

  useEffect(() => {
    let cancelled = false;
    Promise.all([catalogApi.pokemonList(), catalogApi.types()])
      .then(([pokemon, typeList]) => {
        if (cancelled) return;
        setList(pokemon);
        setTypes(typeList);
        if (pokemon.length && selectedId === null) setSelectedId(pokemon[0].id);
      })
      .catch(() => !cancelled && setError(t("editor.loadError")))
      .finally(() => !cancelled && setLoadingList(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    let cancelled = false;
    setLoadingDetail(true);
    setError(null);
    catalogApi
      .pokemon(selectedId)
      .then((data) => !cancelled && setDetail(data))
      .catch(() => !cancelled && setError(t("editor.loadError")))
      .finally(() => !cancelled && setLoadingDetail(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const overriddenIds = overrides.doc.pokemon || {};

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <EntityPicker
        items={list.map((pokemon) => ({
          id: pokemon.id,
          label: lang === "en" ? pokemon.name_en : pokemon.name_es,
          sublabel: `#${pokemon.dex}`,
          modified: Boolean(overriddenIds[String(pokemon.id)]),
        }))}
        selectedId={selectedId}
        placeholder={t("editor.searchPokemon")}
        emptyLabel={t("editor.noResults")}
        onSelect={(id) => setSelectedId(Number(id))}
      />

      <div>
        {error && (
          <p role="alert" className="mb-3 rounded-xl2 bg-panel px-4 py-3 text-sm text-ink shadow-card">
            {error}
          </p>
        )}

        {(loadingList || loadingDetail) && (
          <p className="flex items-center gap-2 py-8 text-sm text-ink-soft">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {t("editor.loading")}
          </p>
        )}

        {!loadingDetail && detail && (
          <PokemonForm
            base={detail}
            override={override}
            types={types}
            lang={lang}
            saving={overrides.saving}
            t={t}
            onSave={(patch) => save(patch)}
            onReset={() => reset()}
          />
        )}
      </div>
    </div>
  );
}

export default function EditorPokemon() {
  const { t } = useI18n() as unknown as I18nShape;
  const overrides = useSessionOverrides();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 animate-fadein">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">{t("editor.pokemonTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {overrides.session
            ? t("editor.editingIn", { name: overrides.session.name })
            : t("editor.subtitle")}
        </p>
      </header>

      {overrides.sessionId === null ? (
        <SessionRequired t={t} />
      ) : (
        <PokemonEditorPane overrides={overrides} />
      )}
    </div>
  );
}
