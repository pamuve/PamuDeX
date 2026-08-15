/**
 * PamuDeX — Tarea 5.1
 * Pantalla /perfiles: rejilla estilo Netflix. Elegir un perfil entra en la app.
 *
 * Móvil primero: la rejilla arranca en 2 columnas para que en una pantalla de
 * 4" el avatar siga siendo un objetivo grande (112px de lado, muy por encima
 * del mínimo táctil de 44px), y crece a 3/4 columnas según el ancho.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Check, X, Loader2, AlertTriangle, Lock, LockOpen } from "lucide-react";
import { profilesApi } from "../lib/apiSession";
import { PinDialog, type PinMode } from "../components/PinDialog";
import {
  useActiveProfile,
  forgetIfMissing,
  syncActiveProfile,
  profileInitial,
  type Profile,
} from "../lib/profile";
import { useI18n } from "../i18n";

/**
 * Avatar circular: emoji del perfil si lo tiene, si no su inicial.
 *
 * El tamaño grande es `min(7rem, 100%)` y no `w-28 h-28` fijo por el escalado
 * de texto de la 8.1: al 130% ese 7rem se convierte en 145px y no cabe en una
 * columna de la rejilla de dos a 320px de ancho. Con `aspect-square` el círculo
 * se encoge sin deformarse.
 */
function Avatar({ profile, size }: { profile: Profile; size: "lg" | "sm" }) {
  const color = profile.color || "#7FB4E8";
  const box = size === "lg" ? "w-[min(7rem,100%)] aspect-square text-4xl" : "w-10 h-10 text-lg";
  return (
    <span
      className={`color-chip ${box} rounded-full flex items-center justify-center font-display font-bold shrink-0 select-none`}
      style={{ backgroundColor: color, color: "#0A1425", "--chip-color": color } as CSSProperties}
      aria-hidden="true"
    >
      {profile.avatar || profileInitial(profile.name)}
    </span>
  );
}

const AVATAR_CHOICES = ["🔥", "💧", "🌿", "⚡", "🧊", "🥊", "🌙", "⭐", "🐉", "👾", "🎮", "🏆"];

interface ProfileFormProps {
  mode: "create" | "edit";
  busy: boolean;
  palette: string[];
  name: string;
  avatar: string;
  color: string;
  onName: (v: string) => void;
  onAvatar: (v: string) => void;
  onColor: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * Formulario de crear/editar. Mismo cuerpo para los dos casos.
 *
 * OJO: tiene que estar en el ámbito del módulo, NO dentro de ProfileSelect.
 * Un componente definido dentro de otro se recrea como tipo nuevo en cada
 * render, así que React desmonta y vuelve a montar el formulario a cada
 * pulsación: el <input> pierde el foco y su onChange no llega a actualizar el
 * estado del padre. Ya pasó una vez aquí; no lo muevas hacia dentro.
 */
function ProfileForm({
  mode,
  busy,
  palette,
  name,
  avatar,
  color,
  onName,
  onAvatar,
  onColor,
  onSubmit,
  onCancel,
}: ProfileFormProps) {
  const { t } = useI18n();

  return (
    <div className="bg-panel rounded-xl2 shadow-card p-4 animate-fadein">
      <label className="block text-sm text-ink-soft mb-1" htmlFor="profile-name">
        {t("profiles.nameLabel")}
      </label>
      <input
        id="profile-name"
        type="text"
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder={t("profiles.namePlaceholder")}
        maxLength={40}
        autoFocus
        className="w-full bg-base border border-hover rounded-lg px-3 py-2.5 text-ink placeholder:text-ink-soft/50 focus:outline-none focus:border-ink-soft"
      />

      <p className="text-sm text-ink-soft mt-3 mb-1.5">{t("profiles.avatarLabel")}</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onAvatar("")}
          aria-pressed={avatar === ""}
          title={t("profiles.avatarInitial")}
          className={`w-11 h-11 rounded-lg text-sm font-bold flex items-center justify-center transition-colors ${
            avatar === "" ? "bg-hover text-ink ring-2 ring-ink" : "bg-base text-ink-soft hover:bg-hover"
          }`}
        >
          {profileInitial(name || "?")}
        </button>
        {AVATAR_CHOICES.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onAvatar(emoji)}
            aria-pressed={avatar === emoji}
            className={`w-11 h-11 rounded-lg text-xl flex items-center justify-center transition-colors ${
              avatar === emoji ? "bg-hover ring-2 ring-ink" : "bg-base hover:bg-hover"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <p className="text-sm text-ink-soft mt-3 mb-1.5">{t("profiles.colorLabel")}</p>
      <div className="flex flex-wrap gap-1.5">
        {palette.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onColor(c)}
            aria-label={c}
            aria-pressed={color === c}
            className={`w-11 h-11 rounded-full transition-transform ${
              color === c ? "ring-2 ring-ink scale-110" : "hover:scale-105"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={onSubmit}
          disabled={!name.trim() || busy}
          className="flex items-center gap-1.5 bg-hover text-ink rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 hover:brightness-125 transition"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {mode === "create" ? t("profiles.create") : t("profiles.save")}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="flex items-center gap-1.5 text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-4 py-2.5 text-sm transition-colors"
        >
          <X size={16} />
          {t("profiles.cancel")}
        </button>
      </div>
    </div>
  );
}

export default function ProfileSelect() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeProfile, setActiveProfile] = useActiveProfile();

  const [list, setList] = useState<Profile[]>([]);
  const [palette, setPalette] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  // Diálogo del PIN: qué perfil y para qué (entrar, poner, cambiar, quitar).
  const [pinTarget, setPinTarget] = useState<{ profile: Profile; mode: PinMode } | null>(null);

  // Borrador compartido por el formulario de crear y el de editar
  const [draftName, setDraftName] = useState("");
  const [draftAvatar, setDraftAvatar] = useState<string>("");
  const [draftColor, setDraftColor] = useState<string>("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [profiles, pal] = await Promise.all([profilesApi.list(), profilesApi.palette()]);
      setList(profiles);
      setPalette(pal.palette);
      // Si el perfil activo se borró desde otro dispositivo, se deja de usar;
      // si solo cambió de nombre o color, se refresca la copia cacheada.
      forgetIfMissing(profiles);
      const mine = profiles.find((p) => p.id === (activeProfile ? activeProfile.id : -1));
      if (mine) syncActiveProfile(mine);
      if (!creating && profiles.length === 0) startCreate(pal.suggested);
    } catch {
      setError(t("profiles.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCreate(suggestedColor?: string) {
    setEditingId(null);
    setConfirmId(null);
    setDraftName("");
    setDraftAvatar("");
    setDraftColor(suggestedColor || palette[0] || "#7FB4E8");
    setCreating(true);
  }

  function startEdit(profile: Profile) {
    setCreating(false);
    setConfirmId(null);
    setDraftName(profile.name);
    setDraftAvatar(profile.avatar || "");
    setDraftColor(profile.color || "#7FB4E8");
    setEditingId(profile.id);
  }

  function closeForm() {
    setCreating(false);
    setEditingId(null);
  }

  /**
   * Elegir un perfil. Si está protegido con PIN, primero el diálogo; sin PIN
   * se entra de un toque, como pide el criterio de aceptación.
   */
  function choose(profile: Profile) {
    if (profile.has_pin) {
      setPinTarget({ profile, mode: "enter" });
      return;
    }
    setActiveProfile(profile);
    navigate("/");
  }

  /** El diálogo del PIN ha terminado bien. Qué hacer depende de para qué se abrió. */
  function handlePinDone(updated: Profile) {
    const mode = pinTarget ? pinTarget.mode : null;
    setPinTarget(null);
    setList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    syncActiveProfile(updated);

    if (mode === "enter") {
      setActiveProfile(updated);
      navigate("/");
    }
  }

  async function handleCreate() {
    const name = draftName.trim();
    if (!name) return;
    setBusyId("new");
    setError(null);
    try {
      const created = await profilesApi.create({
        name,
        avatar: draftAvatar || null,
        color: draftColor,
      });
      setList((prev) => [...prev, created]);
      closeForm();
    } catch {
      setError(t("profiles.saveError"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveEdit(id: number) {
    const name = draftName.trim();
    if (!name) return;
    setBusyId(id);
    setError(null);
    try {
      const updated = await profilesApi.update(id, {
        name,
        avatar: draftAvatar || null,
        color: draftColor,
      });
      setList((prev) => prev.map((p) => (p.id === id ? updated : p)));
      syncActiveProfile(updated); // la TopBar refleja el cambio al momento
      closeForm();
    } catch {
      setError(t("profiles.saveError"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await profilesApi.remove(id);
      setList((prev) => prev.filter((p) => p.id !== id));
      if (activeProfile && activeProfile.id === id) setActiveProfile(null);
      setConfirmId(null);
    } catch {
      setError(t("profiles.deleteError"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-ink text-center">
        {t("profiles.title")}
      </h1>
      <p className="text-ink-soft text-center mt-1.5 mb-8 text-sm sm:text-base">
        {t("profiles.subtitle")}
      </p>

      {error && (
        <div className="bg-panel border border-hover rounded-xl2 p-3 mb-6 flex items-start gap-2 text-sm text-ink animate-fadein">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-ink-soft py-12">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          {t("profiles.loading")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
            {list.map((profile) => {
              const isActive = activeProfile !== null && activeProfile.id === profile.id;
              const busy = busyId === profile.id;

              if (confirmId === profile.id) {
                return (
                  <div
                    key={profile.id}
                    className="bg-panel rounded-xl2 shadow-card p-3 flex flex-col items-center text-center animate-fadein"
                  >
                    <p className="text-sm text-ink font-medium">
                      {t("profiles.confirmDelete", { name: profile.name })}
                    </p>
                    <p className="text-xs text-ink-soft mt-1 mb-3">
                      {t("profiles.confirmDeleteHint")}
                    </p>
                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => handleDelete(profile.id)}
                        disabled={busy}
                        className="flex items-center gap-1 bg-hover text-ink rounded-lg px-3 py-2 text-sm disabled:opacity-50 hover:brightness-125 transition"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        {t("profiles.delete")}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        disabled={busy}
                        className="text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-3 py-2 text-sm transition-colors"
                      >
                        {t("profiles.cancel")}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={profile.id} className="flex flex-col items-center gap-2 animate-fadein">
                  <button
                    onClick={() => choose(profile)}
                    className={`flex flex-col items-center gap-3 p-3 rounded-xl2 w-full transition-colors hover:bg-panel ${
                      isActive ? "bg-panel ring-2 ring-ink" : ""
                    }`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    {/* `w-full max-w-28`: da al avatar el ancho de la columna
                        contra el que medir su `min()`, y mantiene el candado
                        pegado al borde del círculo y no al de la tarjeta. */}
                    <span className="relative w-full max-w-28">
                      <Avatar profile={profile} size="lg" />
                      {profile.has_pin && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-panel border-2 border-base flex items-center justify-center text-ink"
                          title={t("pin.protected")}
                          aria-label={t("pin.protected")}
                        >
                          <Lock size={14} aria-hidden="true" />
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-ink text-sm sm:text-base break-words w-full">
                      {profile.name}
                    </span>
                    {isActive && (
                      <span className="text-[11px] text-ink-soft -mt-2">{t("profiles.active")}</span>
                    )}
                  </button>

                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        setPinTarget({ profile, mode: profile.has_pin ? "remove" : "set" })
                      }
                      title={profile.has_pin ? t("pin.remove") : t("pin.set")}
                      aria-label={
                        profile.has_pin
                          ? t("pin.removeOf", { name: profile.name })
                          : t("pin.setOf", { name: profile.name })
                      }
                      className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-hover transition-colors"
                    >
                      {profile.has_pin ? (
                        <LockOpen size={16} aria-hidden="true" />
                      ) : (
                        <Lock size={16} aria-hidden="true" />
                      )}
                    </button>
                    <button
                      onClick={() => startEdit(profile)}
                      title={t("profiles.edit")}
                      aria-label={t("profiles.editOf", { name: profile.name })}
                      className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-hover transition-colors"
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => setConfirmId(profile.id)}
                      title={t("profiles.delete")}
                      aria-label={t("profiles.deleteOf", { name: profile.name })}
                      className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-hover transition-colors"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}

            {!creating && (
              <button
                onClick={() => startCreate()}
                className="flex flex-col items-center gap-3 p-3 rounded-xl2 w-full transition-colors hover:bg-panel animate-fadein self-start"
              >
                <span className="w-[min(7rem,100%)] aspect-square rounded-full border-2 border-dashed border-hover flex items-center justify-center text-ink-soft">
                  <Plus size={36} aria-hidden="true" />
                </span>
                <span className="font-medium text-ink-soft text-sm sm:text-base">
                  {t("profiles.new")}
                </span>
              </button>
            )}
          </div>

          {(creating || editingId !== null) && (
            <div className="mt-8 max-w-md mx-auto">
              <h2 className="font-display font-bold text-lg text-ink mb-3">
                {creating ? t("profiles.new") : t("profiles.edit")}
              </h2>
              <ProfileForm
                mode={creating ? "create" : "edit"}
                busy={busyId === (creating ? "new" : editingId)}
                palette={palette}
                name={draftName}
                avatar={draftAvatar}
                color={draftColor}
                onName={setDraftName}
                onAvatar={setDraftAvatar}
                onColor={setDraftColor}
                onSubmit={() =>
                  creating ? handleCreate() : handleSaveEdit(editingId as number)
                }
                onCancel={closeForm}
              />
            </div>
          )}

          {!loading && list.length === 0 && !creating && (
            <p className="text-center text-ink-soft mt-8 text-sm">{t("profiles.empty")}</p>
          )}
        </>
      )}

      {pinTarget && (
        <PinDialog
          mode={pinTarget.mode}
          profile={pinTarget.profile}
          onDone={handlePinDone}
          onCancel={() => setPinTarget(null)}
        />
      )}
    </main>
  );
}
