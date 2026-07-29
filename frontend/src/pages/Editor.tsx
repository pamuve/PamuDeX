/**
 * PamuDeX — Tareas 3.4 y 3.5
 * Editor visual completo: Pokémon | Tipos | Movimientos | Habilidades | Relaciones | Tema.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  catalogApi,
  chartApi,
  typeName,
  type AbilityDetail,
  type MoveDetail,
  type TypeMeta,
} from "../lib/apiSession";
import {
  useSessionOverrides,
  useSessionOverride,
  type SessionOverrides,
} from "../hooks/useSessionOverride";
import { useI18n } from "../i18n";
import { applyTheme, type ThemeColors } from "../lib/theme";
import { PokemonEditorPane } from "./EditorPokemon";
import EntityPicker from "../components/forms/EntityPicker";
import TypeForm from "../components/forms/TypeForm";
import MoveForm from "../components/forms/MoveForm";
import AbilityForm from "../components/forms/AbilityForm";
import RelationsMatrix from "../components/forms/RelationsMatrix";
import ThemeForm from "../components/forms/ThemeForm";
import SessionRequired from "../components/SessionRequired";

type Tab = "pokemon" | "types" | "moves" | "abilities" | "relations" | "theme";
const TABS: Tab[] = ["pokemon", "types", "moves", "abilities", "relations", "theme"];

interface I18nShape {
  t: (key: string, params?: Record<string, string>) => string;
  lang?: string;
}

function Spinner({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 py-8 text-sm text-ink-soft">
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      {label}
    </p>
  );
}

/* ------------------------------- Tipos ------------------------------- */

function TypesPane({ overrides }: { overrides: SessionOverrides }) {
  const { t, lang } = useI18n() as unknown as I18nShape;
  const [types, setTypes] = useState<TypeMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { override, save, reset } = useSessionOverride(overrides, "types", selectedId);
  const bucket = overrides.doc.types || {};

  useEffect(() => {
    let cancelled = false;
    catalogApi
      .types()
      .then((list) => {
        if (cancelled) return;
        setTypes(list);
        if (list.length) setSelectedId((current) => current ?? list[0].id);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = types.find((type) => type.id === selectedId) || null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <EntityPicker
        items={types.map((type) => ({
          id: type.id,
          label: typeName(type, lang),
          color: type.color,
          modified: Boolean(bucket[type.id]),
        }))}
        selectedId={selectedId}
        placeholder={t("editor.searchType")}
        emptyLabel={t("editor.noResults")}
        onSelect={(id) => setSelectedId(String(id))}
      />
      <div>
        {loading && <Spinner label={t("editor.loading")} />}
        {selected && (
          <TypeForm base={selected} override={override} saving={overrides.saving} t={t}
            onSave={(patch) => save(patch)} onReset={() => reset()} />
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Movimientos ---------------------------- */

function MovesPane({ overrides }: { overrides: SessionOverrides }) {
  const { t, lang } = useI18n() as unknown as I18nShape;
  const [list, setList] = useState<MoveDetail[]>([]);
  const [types, setTypes] = useState<TypeMeta[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MoveDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const { override, save, reset } = useSessionOverride(overrides, "moves", selectedId);
  const bucket = overrides.doc.moves || {};

  useEffect(() => {
    let cancelled = false;
    Promise.all([catalogApi.moves(), catalogApi.types()])
      .then(([moves, typeList]) => {
        if (cancelled) return;
        setList(moves);
        setTypes(typeList);
        if (moves.length) setSelectedId((current) => current ?? moves[0].id);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    let cancelled = false;
    catalogApi.move(selectedId).then((data) => !cancelled && setDetail(data));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <EntityPicker
        items={list.map((move) => ({
          id: move.id,
          label: lang === "en" ? move.name_en : move.name_es,
          color: (types.find((type) => type.id === move.type_id) || {}).color,
          modified: Boolean(bucket[String(move.id)]),
        }))}
        selectedId={selectedId}
        placeholder={t("editor.searchMove")}
        emptyLabel={t("editor.noResults")}
        onSelect={(id) => setSelectedId(Number(id))}
      />
      <div>
        {loading && <Spinner label={t("editor.loading")} />}
        {detail && (
          <MoveForm base={detail} override={override} types={types} lang={lang}
            saving={overrides.saving} t={t} onSave={(patch) => save(patch)} onReset={() => reset()} />
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Habilidades ---------------------------- */

function AbilitiesPane({ overrides }: { overrides: SessionOverrides }) {
  const { t, lang } = useI18n() as unknown as I18nShape;
  const [list, setList] = useState<AbilityDetail[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AbilityDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const { override, save, reset } = useSessionOverride(overrides, "abilities", selectedId);
  const bucket = overrides.doc.abilities || {};

  useEffect(() => {
    let cancelled = false;
    catalogApi
      .abilities()
      .then((abilities) => {
        if (cancelled) return;
        setList(abilities);
        if (abilities.length) setSelectedId((current) => current ?? abilities[0].id);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    let cancelled = false;
    catalogApi.ability(selectedId).then((data) => !cancelled && setDetail(data));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <EntityPicker
        items={list.map((ability) => ({
          id: ability.id,
          label: lang === "en" ? ability.name_en : ability.name_es,
          modified: Boolean(bucket[String(ability.id)]),
        }))}
        selectedId={selectedId}
        placeholder={t("editor.searchAbility")}
        emptyLabel={t("editor.noResults")}
        onSelect={(id) => setSelectedId(Number(id))}
      />
      <div>
        {loading && <Spinner label={t("editor.loading")} />}
        {detail && (
          <AbilityForm base={detail} override={override} saving={overrides.saving} t={t}
            onSave={(patch) => save(patch)} onReset={() => reset()} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Relaciones ---------------------------- */

function RelationsPane({ overrides }: { overrides: SessionOverrides }) {
  const { t, lang } = useI18n() as unknown as I18nShape;
  const [types, setTypes] = useState<TypeMeta[]>([]);
  const [baseChart, setBaseChart] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Se pide la tabla global; los overrides se mezclan aquí para que el
    // repintado sea inmediato al pulsar una celda.
    chartApi
      .get(false)
      .then((data) => {
        if (cancelled) return;
        setTypes(data.types);
        setBaseChart(data.chart);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const relationOverrides = overrides.doc.relations || {};

  const chart = useMemo(() => {
    const merged: Record<string, Record<string, number>> = {};
    for (const attacker of Object.keys(baseChart)) {
      merged[attacker] = { ...baseChart[attacker], ...(relationOverrides[attacker] || {}) };
    }
    return merged;
  }, [baseChart, relationOverrides]);

  if (loading) return <Spinner label={t("editor.loading")} />;

  return (
    <RelationsMatrix
      types={types}
      chart={chart}
      overrides={relationOverrides}
      lang={lang}
      saving={overrides.saving}
      t={t}
      onChange={(attacker, defender, multiplier) =>
        overrides.setRelation(attacker, defender, multiplier)
      }
      onResetAll={() => overrides.resetRelations()}
    />
  );
}

/* -------------------------------- Página ------------------------------ */

export default function Editor() {
  const { t } = useI18n() as unknown as I18nShape;
  const overrides = useSessionOverrides();
  const [tab, setTab] = useState<Tab>("pokemon");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 animate-fadein">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">{t("editor.title")}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {overrides.session
            ? t("editor.editingIn", { name: overrides.session.name })
            : t("editor.subtitle")}
        </p>
      </header>

      {overrides.sessionId === null ? (
        <SessionRequired t={t} />
      ) : (
        <>
          <div role="tablist" aria-label={t("editor.title")}
            className="mb-4 flex gap-1 overflow-x-auto rounded-xl2 bg-panel p-1 shadow-card">
            {TABS.map((item) => (
              <button
                key={item}
                role="tab"
                type="button"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
                className={
                  "shrink-0 rounded-lg px-3 py-2 text-sm transition-colors " +
                  "focus:outline-none focus:ring-2 focus:ring-ink-soft/40 " +
                  (tab === item ? "bg-hover text-ink" : "text-ink-soft hover:text-ink")
                }
              >
                {t(`editor.tabs.${item}`)}
              </button>
            ))}
          </div>

          {overrides.error === "save" && (
            <p role="alert" className="mb-3 rounded-xl2 bg-panel px-4 py-3 text-sm text-ink shadow-card">
              {t("editor.saveError")}
            </p>
          )}

          {tab === "pokemon" && <PokemonEditorPane overrides={overrides} />}
          {tab === "types" && <TypesPane overrides={overrides} />}
          {tab === "moves" && <MovesPane overrides={overrides} />}
          {tab === "abilities" && <AbilitiesPane overrides={overrides} />}
          {tab === "relations" && <RelationsPane overrides={overrides} />}
          {tab === "theme" && (
            <ThemeForm
              theme={(overrides.doc.theme as Partial<ThemeColors>) || null}
              saving={overrides.saving}
              t={t}
              onSave={async (theme) => {
                await overrides.setTheme(theme as unknown as Record<string, string>);
                applyTheme(theme);
              }}
              onReset={async () => {
                await overrides.setTheme(null);
                applyTheme(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
