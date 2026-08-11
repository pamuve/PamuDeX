/**
 * PamuDeX — Tarea 5.4
 * Página /ajustes: las preferencias del perfil activo.
 *
 * DÓNDE SE GUARDA CADA COSA (decisión de la 5.4)
 * ----------------------------------------------
 *  - idioma y tema -> columnas `profiles.language` y `profiles.theme`. Viajan
 *    dentro del perfil cacheado, así que se aplican en el primer render y sin
 *    conexión.
 *  - historial activado y sesión de ROM Hack -> tabla `settings`, vía
 *    `lib/settings.ts`.
 *
 * El nombre, el avatar, el color y el PIN NO se editan aquí: son la identidad
 * del perfil y se gestionan en /perfiles, que es su pantalla.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  History as HistoryIcon,
  Layers,
  Loader2,
  Palette,
  UserCircle2,
  Users,
} from "lucide-react";
import { profilesApi } from "../lib/apiSession";
import { useActiveProfile, syncActiveProfile } from "../lib/profile";
import { useActiveSession } from "../lib/session";
import { useSettings } from "../lib/settings";
import { PROFILE_THEMES, PROFILE_THEME_IDS } from "../lib/theme";
import { useI18n, AVAILABLE_LANGS } from "../i18n";

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const [profile] = useActiveProfile();
  const [sessionId] = useActiveSession();
  const { settings, update } = useSettings();

  const [guardandoTema, setGuardandoTema] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sin perfil no hay ajustes: son de alguien, no de la app.
  if (!profile) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12 text-center">
        <UserCircle2 size={40} className="mx-auto text-ink-soft mb-3" aria-hidden="true" />
        <h1 className="font-display font-bold text-2xl text-ink mb-2">{t("settings.title")}</h1>
        <p className="text-ink-soft mb-5">{t("settings.needProfile")}</p>
        <Link
          to="/perfiles"
          className="inline-block bg-panel hover:bg-hover text-ink rounded-lg px-5 py-2.5 text-sm transition-colors"
        >
          {t("profiles.choose")}
        </Link>
      </main>
    );
  }

  const temaActual = PROFILE_THEMES[profile.theme] ? profile.theme : "oled";
  const historialActivo = settings.history_enabled !== "0";

  async function elegirTema(nombre: string) {
    if (!profile || nombre === temaActual) return;
    setGuardandoTema(true);
    setError(null);
    try {
      // syncActiveProfile refresca la copia cacheada; useAppTheme() está
      // pendiente de `profile.theme` y repinta las variables CSS al momento.
      syncActiveProfile(await profilesApi.update(profile.id, { theme: nombre }));
    } catch {
      setError(t("settings.saveError"));
    } finally {
      setGuardandoTema(false);
    }
  }

  async function alternarHistorial() {
    setError(null);
    try {
      await update("history_enabled", historialActivo ? "0" : "1");
    } catch {
      setError(t("settings.saveError"));
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-ink">{t("settings.title")}</h1>
        <p className="text-ink-soft text-sm mt-1">
          {t("settings.subtitle", { name: profile.name })}
        </p>
      </div>

      {error && (
        <div className="bg-panel border border-hover rounded-xl2 p-3 text-sm text-ink animate-fadein">
          {error}
        </div>
      )}

      {/* Idioma ------------------------------------------------------- */}
      <section className="bg-panel rounded-xl2 shadow-card p-5 animate-fadein">
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-1">
          {t("settings.language")}
        </h2>
        <p className="text-ink-soft text-xs mb-3">{t("settings.languageHint")}</p>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              aria-pressed={lang === l.code}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors ${
                lang === l.code ? "bg-hover text-ink ring-2 ring-ink" : "bg-base text-ink-soft hover:bg-hover"
              }`}
            >
              <span className="text-lg" aria-hidden="true">
                {l.flag}
              </span>
              {l.label}
              {lang === l.code && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </section>

      {/* Tema --------------------------------------------------------- */}
      <section className="bg-panel rounded-xl2 shadow-card p-5 animate-fadein">
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-1 flex items-center gap-2">
          <Palette size={14} aria-hidden="true" />
          {t("settings.theme")}
          {guardandoTema && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        </h2>
        <p className="text-ink-soft text-xs mb-3">{t("settings.themeHint")}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PROFILE_THEME_IDS.map((id) => {
            const paleta = PROFILE_THEMES[id];
            const activo = id === temaActual;
            return (
              <button
                key={id}
                onClick={() => elegirTema(id)}
                aria-pressed={activo}
                disabled={guardandoTema}
                className={`rounded-xl2 p-3 text-left transition-transform disabled:opacity-60 ${
                  activo ? "ring-2 ring-ink" : "hover:scale-[1.02]"
                }`}
                style={{ backgroundColor: paleta.panel }}
              >
                <span className="flex gap-1.5 mb-2" aria-hidden="true">
                  {[paleta.base, paleta.hover, paleta.accent || paleta.inkSoft].map((c, i) => (
                    <span
                      key={i}
                      className="w-5 h-5 rounded-full border border-black/20"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
                <span className="text-sm font-medium block" style={{ color: paleta.ink }}>
                  {t(`settings.theme.${id}`)}
                </span>
              </button>
            );
          })}
        </div>

        {/* La sesión pisa al perfil: mejor decirlo que dejar que parezca un fallo. */}
        {sessionId !== null && (
          <p className="flex items-start gap-2 text-ink-soft text-xs mt-3 border-t border-hover pt-3">
            <Layers size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              {t("settings.themeSessionWins")}{" "}
              <Link to="/sesiones" className="underline hover:text-ink">
                {t("sessions.nav")}
              </Link>
            </span>
          </p>
        )}
      </section>

      {/* Historial ---------------------------------------------------- */}
      <section className="bg-panel rounded-xl2 shadow-card p-5 animate-fadein">
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-1 flex items-center gap-2">
          <HistoryIcon size={14} aria-hidden="true" />
          {t("settings.history")}
        </h2>
        <p className="text-ink-soft text-xs mb-3">{t("settings.historyHint")}</p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={alternarHistorial}
            role="switch"
            aria-checked={historialActivo}
            className="flex items-center gap-2 bg-base hover:bg-hover rounded-lg px-4 py-2.5 text-sm text-ink transition-colors"
          >
            <span
              className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${
                historialActivo ? "bg-[#78C850]" : "bg-hover"
              }`}
              aria-hidden="true"
            >
              <span
                className={`w-4 h-4 rounded-full bg-ink transition-transform ${
                  historialActivo ? "translate-x-4" : ""
                }`}
              />
            </span>
            {historialActivo ? t("settings.historyOn") : t("settings.historyOff")}
          </button>

          <Link
            to="/historial"
            className="flex items-center gap-1.5 text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-3 py-2.5 text-sm transition-colors"
          >
            <HistoryIcon size={16} aria-hidden="true" />
            {t("history.title")}
          </Link>
        </div>
      </section>

      {/* Identidad del perfil ---------------------------------------- */}
      <section className="bg-panel rounded-xl2 shadow-card p-5 animate-fadein">
        <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-1">
          {t("settings.profile")}
        </h2>
        <p className="text-ink-soft text-xs mb-3">{t("settings.profileHint")}</p>
        <Link
          to="/perfiles"
          className="inline-flex items-center gap-1.5 bg-base hover:bg-hover text-ink rounded-lg px-4 py-2.5 text-sm transition-colors"
        >
          <Users size={16} aria-hidden="true" />
          {t("profiles.title")}
        </Link>
      </section>
    </main>
  );
}
