/**
 * PamuDeX — Fase 9
 * Las dos herramientas del comparador que no son el combate en sí:
 *
 *  - `SavedTeamsPanel`: la estantería de equipos con nombre, por perfil y por
 *    juego (`/api/teams`).
 *  - `TeamTextPanel`: importar y exportar en texto (Showdown o el formato
 *    propio, `lib/teamText.ts`).
 *
 * El equipo EN USO sigue en `localStorage` y se guarda solo en cada cambio:
 * tiene que funcionar sin conexión. Guardar aquí es dejar una copia con nombre
 * en el servidor; cargar es traerla a la mesa, sustituyendo lo que haya.
 */
import { useEffect, useRef, useState } from "react";
import { ClipboardCopy, Download, FolderOpen, Save, Trash2, Upload } from "lucide-react";
import { teamsApi, type SavedTeamSummary } from "../lib/apiSession";
import { getActiveProfileId } from "../lib/profile";
import { useScope } from "../lib/scope";
import {
  parseTeam,
  serializeTeam,
  toRivalSlots,
  type Catalog,
  type SlotForText,
  type TeamTextFormat,
} from "../lib/teamText";
import { api } from "../lib/api";
import { useI18n } from "../i18n";
import type { AbilitySummary, PokemonDetail, RivalTeam, Team } from "../types";

const INPUT =
  "min-h-[2.75rem] max-w-full rounded-lg bg-hover px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent";

/* ----------------------------- equipos guardados --------------------------- */

export function SavedTeamsPanel({
  own,
  rival,
  onLoad,
}: {
  own: Team;
  rival: RivalTeam;
  onLoad: (own: Team, rival: RivalTeam) => void;
}) {
  const { t } = useI18n();
  const scope = useScope();
  const profileId = getActiveProfileId();
  const [lista, setLista] = useState<SavedTeamSummary[] | null>(null);
  const [nombre, setNombre] = useState("");
  const [aviso, setAviso] = useState("");
  const [fallo, setFallo] = useState(false);
  const [confirmar, setConfirmar] = useState<number | null>(null);

  async function recargar() {
    if (profileId === null) return;
    try {
      setLista((await teamsApi.list(profileId, scope)).items);
      setFallo(false);
    } catch {
      setFallo(true);
    }
  }

  useEffect(() => {
    void recargar();
  }, [profileId, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  if (profileId === null) return null;

  /** Ejecuta una acción contra el servidor y anuncia cómo ha ido. */
  async function hacer(accion: () => Promise<unknown>, hecho: string) {
    setAviso("");
    try {
      await accion();
      setFallo(false);
      setAviso(hecho);
      await recargar();
    } catch {
      setFallo(true);
    }
  }

  const datos = { own, rival };
  const vacio = own.slots.length === 0 && rival.slots.length === 0;

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="section-title">{t("teams.saved")}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t(`teams.scope.${scope.split(":")[0]}`)}</p>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const limpio = nombre.trim();
          if (!limpio || vacio) return;
          void hacer(() => teamsApi.create(profileId, scope, limpio, datos), t("teams.savedOk", { name: limpio })).then(
            () => setNombre("")
          );
        }}
      >
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={60}
          placeholder={t("teams.namePlaceholder")}
          aria-label={t("teams.name")}
          className={`${INPUT} min-w-[min(12rem,100%)] flex-1`}
        />
        <button type="submit" className="btn-primary" disabled={!nombre.trim() || vacio}>
          <Save size={16} aria-hidden="true" />
          {t("teams.saveCurrent")}
        </button>
      </form>

      {lista && lista.length === 0 && <p className="text-sm text-ink-soft">{t("teams.empty")}</p>}

      {lista && lista.length > 0 && (
        <ul className="divide-y divide-hover">
          {lista.map((equipo) => (
            <li key={equipo.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1 break-words text-sm font-medium text-ink">{equipo.name}</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  void hacer(async () => {
                    const completo = await teamsApi.get(profileId, equipo.id);
                    const d = completo.data as { own?: Team; rival?: RivalTeam };
                    onLoad(
                      d.own && Array.isArray(d.own.slots) ? d.own : { slots: [] },
                      d.rival && Array.isArray(d.rival.slots) ? d.rival : { slots: [] }
                    );
                  }, t("teams.loadedOk", { name: equipo.name }))
                }
              >
                <FolderOpen size={16} aria-hidden="true" />
                {t("teams.load")}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={vacio}
                onClick={() =>
                  void hacer(
                    () => teamsApi.update(profileId, equipo.id, { data: datos }),
                    t("teams.savedOk", { name: equipo.name })
                  )
                }
              >
                <Save size={16} aria-hidden="true" />
                {t("teams.overwrite")}
              </button>
              {confirmar === equipo.id ? (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    setConfirmar(null);
                    void hacer(() => teamsApi.remove(profileId, equipo.id), t("teams.deletedOk", { name: equipo.name }));
                  }}
                >
                  {t("teams.confirmDelete")}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-ghost h-11 w-11 px-0"
                  aria-label={t("teams.delete", { name: equipo.name })}
                  onClick={() => setConfirmar(equipo.id)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className={`text-sm ${fallo ? "text-danger" : "text-ink-soft"}`} role="status" aria-live="polite">
        {fallo ? t("teams.error") : aviso}
      </p>
    </section>
  );
}

/* --------------------------- importar y exportar --------------------------- */

type Destino = "own" | "rival";

export function TeamTextPanel({
  own,
  rival,
  catalog,
  pokemonById,
  onImport,
}: {
  own: Team;
  rival: RivalTeam;
  /** Listados ya cargados por el comparador. Las habilidades se piden aquí. */
  catalog: Omit<Catalog, "abilities">;
  pokemonById: Record<number, PokemonDetail>;
  onImport: (destino: Destino, own: Team, rival: RivalTeam) => void;
}) {
  const { t, name } = useI18n();
  const [destino, setDestino] = useState<Destino>("own");
  const [formato, setFormato] = useState<TeamTextFormat>("showdown");
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const [malo, setMalo] = useState(false);
  const [abilities, setAbilities] = useState<AbilitySummary[]>([]);
  const archivo = useRef<HTMLInputElement>(null);

  // Solo hacen falta para importar (pasar «Static» a «Elec. Estática»).
  useEffect(() => {
    api.abilities.list().then(setAbilities).catch(() => {});
  }, []);

  function decir(mensaje: string, error = false) {
    setAviso(mensaje);
    setMalo(error);
  }

  function exportar(): string {
    const slots: SlotForText[] =
      destino === "own"
        ? own.slots
        : rival.slots.map((s) => ({
            pokemonId: s.pokemonId,
            item: s.item,
            ability: s.ability,
            moveIds: [...s.knownMoveIds, ...s.suspectedMoveIds],
          }));
    const salida = serializeTeam(slots, formato, { ...catalog, pokemonById, name });
    setTexto(salida);
    decir(salida ? t("teamText.exported") : t("teamText.nothingToExport"), !salida);
    return salida;
  }

  async function copiar() {
    const salida = texto || exportar();
    if (!salida) return;
    try {
      await navigator.clipboard.writeText(salida);
      decir(t("teamText.copied"));
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS): el texto queda en el cuadro
      // para copiarlo a mano.
      decir(t("teamText.copyFailed"), true);
    }
  }

  function descargar() {
    const salida = texto || exportar();
    if (!salida) return;
    const url = URL.createObjectURL(new Blob([salida], { type: "text/plain;charset=utf-8" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `pamudex-${destino === "own" ? "equipo" : "rival"}.txt`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  function importar() {
    if (!texto.trim()) return decir(t("teamText.empty"), true);
    const leido = parseTeam(texto, { ...catalog, abilities });
    if (!leido.slots.length) return decir(t("teamText.nothingRecognized"), true);

    if (destino === "own") onImport("own", { slots: leido.slots }, rival);
    else onImport("rival", own, { slots: toRivalSlots(leido.slots) });

    decir(
      leido.warnings.length
        ? t("teamText.importedWithWarnings", { count: leido.slots.length, list: leido.warnings.join(", ") })
        : t("teamText.imported", { count: leido.slots.length }),
      leido.warnings.length > 0
    );
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="section-title">{t("teamText.title")}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t("teamText.hint")}</p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <label className="flex min-w-0 max-w-full flex-col gap-1 text-xs text-ink-soft">
          {t("teamText.target")}
          <select value={destino} onChange={(e) => setDestino(e.target.value as Destino)} className={INPUT}>
            <option value="own">{t("team.own")}</option>
            <option value="rival">{t("team.rival")}</option>
          </select>
        </label>
        <label className="flex min-w-0 max-w-full flex-col gap-1 text-xs text-ink-soft">
          {t("teamText.format")}
          <select value={formato} onChange={(e) => setFormato(e.target.value as TeamTextFormat)} className={INPUT}>
            <option value="showdown">Pokémon Showdown</option>
            <option value="pamudex">{t("teamText.formatSimple")}</option>
          </select>
        </label>
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={8}
        spellCheck={false}
        aria-label={t("teamText.text")}
        placeholder={
          formato === "showdown"
            ? "Pikachu @ Light Ball\nAbility: Static\nTimid Nature\n- Thunderbolt\n- Volt Switch"
            : t("teamText.simpleExample")
        }
        className="w-full rounded-lg bg-hover p-3 font-mono text-sm text-ink outline-none placeholder:text-ink-soft/50 focus-visible:ring-2 focus-visible:ring-accent"
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={importar}>
          <Upload size={16} aria-hidden="true" />
          {t("teamText.import")}
        </button>
        <button type="button" className="btn-secondary" onClick={exportar}>
          <Download size={16} aria-hidden="true" />
          {t("teamText.export")}
        </button>
        <button type="button" className="btn-ghost" onClick={() => void copiar()}>
          <ClipboardCopy size={16} aria-hidden="true" />
          {t("teamText.copy")}
        </button>
        <button type="button" className="btn-ghost" onClick={descargar}>
          {t("teamText.download")}
        </button>
        <button type="button" className="btn-ghost" onClick={() => archivo.current?.click()}>
          {t("teamText.openFile")}
        </button>
        <input
          ref={archivo}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setTexto(await f.text());
            e.target.value = "";
          }}
        />
      </div>

      <p className={`text-sm ${malo ? "text-warning" : "text-ink-soft"}`} role="status" aria-live="polite">
        {aviso}
      </p>
    </section>
  );
}
