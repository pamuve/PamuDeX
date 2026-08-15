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
  Bell,
  BellOff,
  Check,
  Contrast,
  History as HistoryIcon,
  Layers,
  Loader2,
  Palette,
  Type,
  UserCircle2,
  Users,
} from "lucide-react";
import { profilesApi } from "../lib/apiSession";
import { useActiveProfile, syncActiveProfile } from "../lib/profile";
import { useActiveSession } from "../lib/session";
import { useSettings } from "../lib/settings";
import { useA11y, TEXT_SCALES } from "../lib/a11y";
import { useNotifications } from "../lib/notifications";
import { OfflineData } from "../components/OfflineData";
import { PROFILE_THEMES, PROFILE_THEME_IDS } from "../lib/theme";
import { useI18n, AVAILABLE_LANGS } from "../i18n";

/**
 * Accesibilidad (Tarea 8.1).
 *
 * Es un componente aparte porque se pinta TAMBIÉN sin perfil activo: quien
 * necesita alto contraste o texto grande tiene que poder encenderlo antes de
 * nada, y estas dos preferencias son del aparato (`localStorage`), no del
 * perfil — la copia por perfil la lleva `lib/settings.ts` por su cuenta.
 *
 * La vista previa inmediata que pide el encargo es la página entera: al escribir
 * en <html> el cambio se ve al instante en todo. El recuadro de ejemplo está
 * para poder comparar texto principal y secundario de un vistazo.
 */
function Accesibilidad() {
  const { t } = useI18n();
  const [a11y, setA11yPref] = useA11y();

  return (
    <section className="bg-panel rounded-xl2 shadow-card p-5 animate-fadein">
      <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-1 flex items-center gap-2">
        <Contrast size={14} aria-hidden="true" />
        {t("settings.a11y")}
      </h2>
      <p className="text-ink-soft text-xs mb-4">{t("settings.a11yHint")}</p>

      {/* Alto contraste */}
      <p className="text-ink text-sm font-medium">{t("settings.highContrast")}</p>
      <p className="text-ink-soft text-xs mb-3">{t("settings.highContrastHint")}</p>
      <button
        onClick={() => setA11yPref({ highContrast: !a11y.highContrast })}
        role="switch"
        aria-checked={a11y.highContrast}
        className="flex items-center gap-2 bg-base hover:bg-hover rounded-lg px-4 py-2.5 text-sm text-ink transition-colors"
      >
        <span
          className={`w-9 h-5 rounded-full flex items-center px-0.5 shrink-0 transition-colors ${
            a11y.highContrast ? "bg-[#78C850]" : "bg-hover"
          }`}
          aria-hidden="true"
        >
          <span
            className={`w-4 h-4 rounded-full bg-ink transition-transform ${
              a11y.highContrast ? "translate-x-4" : ""
            }`}
          />
        </span>
        {a11y.highContrast ? t("settings.on") : t("settings.off")}
      </button>

      {/* Escalado de texto */}
      <div className="border-t border-hover mt-5 pt-4">
        <p className="text-ink text-sm font-medium flex items-center gap-2">
          <Type size={14} aria-hidden="true" />
          {t("settings.textScale")}
        </p>
        <p className="text-ink-soft text-xs mb-3">{t("settings.textScaleHint")}</p>

        {/* `radiogroup` y no botones sueltos: son cuatro opciones excluyentes, y
            así el lector de pantalla las anuncia como "3 de 4". */}
        <div
          role="radiogroup"
          aria-label={t("settings.textScale")}
          className="flex flex-wrap gap-2"
        >
          {TEXT_SCALES.map((escala) => {
            const activo = a11y.textScale === escala;
            return (
              <button
                key={escala}
                role="radio"
                aria-checked={activo}
                onClick={() => setA11yPref({ textScale: escala })}
                className={`flex items-baseline gap-1.5 rounded-lg px-4 py-2.5 transition-colors ${
                  activo ? "bg-hover text-ink ring-2 ring-ink" : "bg-base text-ink-soft hover:bg-hover"
                }`}
              >
                <span className="text-sm">{t(`settings.textScale.${escala}`)}</span>
                <span className="text-xs opacity-80" aria-hidden="true">
                  {escala}%
                </span>
                {activo && <Check size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Vista previa */}
      <div className="border-t border-hover mt-5 pt-4">
        <p className="font-display text-xs tracking-widest text-ink-soft uppercase mb-2">
          {t("settings.a11yPreview")}
        </p>
        <div className="bg-base rounded-xl2 p-4">
          <p className="text-ink text-base">{t("settings.a11yPreviewText")}</p>
          <p className="text-ink-soft text-sm mt-1">{t("settings.a11yPreviewSoft")}</p>
        </div>
      </div>
    </section>
  );
}

/**
 * Notificaciones opcionales (Tarea 8.3).
 *
 * Va junto a la accesibilidad, y también fuera de la puerta del perfil, porque
 * es otra preferencia del APARATO: el permiso lo concede el navegador al sitio
 * entero. Ver la cabecera de `lib/notifications.ts`.
 *
 * Las tres reglas del encargo, aquí:
 *  1. Empieza apagado y el permiso NO se pide hasta que se pulsa.
 *  2. Se dice para qué sirven antes de pedir nada.
 *  3. Con el permiso denegado se explica cómo revertirlo UNA vez, el
 *     interruptor se queda deshabilitado y no se vuelve a insistir.
 */
function Notificaciones() {
  const { t } = useI18n();
  const { activadas, permiso, alternar } = useNotifications();
  const [ocupado, setOcupado] = useState(false);

  const denegado = permiso === "denied";
  const sinSoporte = permiso === "unsupported";

  async function pulsar() {
    setOcupado(true);
    try {
      await alternar();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="bg-panel rounded-xl2 shadow-card p-5 animate-fadein">
      <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-1 flex items-center gap-2">
        <Bell size={14} aria-hidden="true" />
        {t("settings.notifications")}
      </h2>
      <p className="text-ink-soft text-xs mb-3">{t("settings.notificationsHint")}</p>

      {sinSoporte ? (
        <p className="flex items-start gap-2 text-ink-soft text-xs bg-base rounded-lg p-3">
          <BellOff size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t("settings.notificationsUnsupported")}</span>
        </p>
      ) : (
        <>
          <button
            onClick={pulsar}
            role="switch"
            aria-checked={activadas}
            disabled={denegado || ocupado}
            className="flex items-center gap-2 bg-base hover:bg-hover disabled:opacity-60
                       disabled:cursor-not-allowed rounded-lg px-4 py-2.5 text-sm text-ink transition-colors"
          >
            <span
              className={`w-9 h-5 rounded-full flex items-center px-0.5 shrink-0 transition-colors ${
                activadas ? "bg-[#78C850]" : "bg-hover"
              }`}
              aria-hidden="true"
            >
              <span
                className={`w-4 h-4 rounded-full bg-ink transition-transform ${
                  activadas ? "translate-x-4" : ""
                }`}
              />
            </span>
            {activadas ? t("settings.on") : t("settings.off")}
          </button>

          {/* Permiso denegado: se explica cómo deshacerlo y no se insiste más.
              El navegador no deja volver a preguntar desde la página. */}
          {denegado && (
            <p className="flex items-start gap-2 text-ink-soft text-xs mt-3 border-t border-hover pt-3">
              <BellOff size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t("settings.notificationsBlocked")}</span>
            </p>
          )}
        </>
      )}
    </section>
  );
}

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
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <div className="text-center">
          <UserCircle2 size={40} className="mx-auto text-ink-soft mb-3" aria-hidden="true" />
          <h1 className="font-display font-bold text-2xl text-ink mb-2">{t("settings.title")}</h1>
          <p className="text-ink-soft mb-5">{t("settings.needProfile")}</p>
          <Link
            to="/perfiles"
            className="inline-block bg-panel hover:bg-hover text-ink rounded-lg px-5 py-2.5 text-sm transition-colors"
          >
            {t("profiles.choose")}
          </Link>
        </div>
        {/* La accesibilidad sí se puede tocar sin perfil: es del aparato. */}
        <Accesibilidad />
        <Notificaciones />
        <OfflineData />
      </div>
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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
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

      {/* Accesibilidad ------------------------------------------------ */}
      <Accesibilidad />

      {/* Notificaciones ---------------------------------------------- */}
      <Notificaciones />

      {/* Datos sin conexión y depuración --------------------------- */}
      <OfflineData />

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
    </div>
  );
}
