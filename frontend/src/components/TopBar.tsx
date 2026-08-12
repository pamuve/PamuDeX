import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Settings, UserCircle2, ChevronDown, Swords, Layers, SlidersHorizontal, DatabaseBackup, Users, LogOut, Star, History, Shield } from "lucide-react";
import { useI18n, AVAILABLE_LANGS } from "../i18n";
import { useActiveProfile, profileInitial } from "../lib/profile";

/**
 * Menú «Modo». Sigue siendo un marcador de posición: encender el modo Champions
 * y volver al estándar es cosa de la tarea 6.3. Lo único real que hay hoy es el
 * editor de reglas de la 6.1, que se enlaza aquí para que la pantalla sea
 * alcanzable mientras tanto.
 */
function ModeMenu({ label, items }: { label: string; items: string[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-2 py-1.5 transition-colors"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {label}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-panel border border-hover rounded-xl2 shadow-card p-2 z-20 animate-fadein">
          {items.map((it) => (
            <div key={it} className="px-3 py-2 rounded-lg text-sm text-ink-soft hover:bg-hover hover:text-ink cursor-not-allowed opacity-70">
              {it}
            </div>
          ))}
          <Link
            to="/champions/reglas"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-hover border-t border-hover mt-1"
          >
            <Shield size={16} aria-hidden="true" />
            {t("champions.title")}
          </Link>
          <div className="px-3 pt-2 text-[11px] text-ink-soft/70">{t("champions.modeSoon")}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Menú del perfil activo (Tarea 5.1): avatar + nombre, con acceso para cambiar
 * de perfil o salir. Sin perfil activo se convierte en un enlace a /perfiles.
 */
function ProfileMenu() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useActiveProfile();
  const [open, setOpen] = useState(false);

  if (!profile) {
    return (
      <Link
        to="/perfiles"
        className="flex items-center gap-1.5 text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-2 py-1.5 transition-colors text-sm"
        title={t("profiles.title")}
      >
        <UserCircle2 size={22} aria-hidden="true" />
        <span className="hidden sm:inline">{t("profiles.choose")}</span>
      </Link>
    );
  }

  const color = profile.color || "#7FB4E8";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-ink-soft hover:text-ink hover:bg-hover transition-colors"
        aria-haspopup="true"
        aria-expanded={open}
        title={t("profiles.activeProfile", { name: profile.name })}
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0 select-none"
          style={{ backgroundColor: color, color: "#0A1425" }}
          aria-hidden="true"
        >
          {profile.avatar || profileInitial(profile.name)}
        </span>
        <span className="hidden sm:inline text-sm max-w-[8rem] truncate">{profile.name}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-panel border border-hover rounded-xl2 shadow-card p-2 z-20 animate-fadein">
          <p className="px-3 py-1.5 text-[11px] text-ink-soft/70 border-b border-hover mb-1">
            {t("profiles.activeProfile", { name: profile.name })}
          </p>
          {/* Historial y ajustes viven aquí y no en la barra: son del perfil,
              y la barra ya va justa de sitio en móvil. */}
          <button
            onClick={() => {
              setOpen(false);
              navigate("/historial");
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-hover text-left"
          >
            <History size={16} aria-hidden="true" />
            {t("history.title")}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              navigate("/ajustes");
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-hover text-left"
          >
            <Settings size={16} aria-hidden="true" />
            {t("nav.settings")}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              navigate("/perfiles");
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-hover text-left"
          >
            <Users size={16} aria-hidden="true" />
            {t("profiles.switch")}
          </button>
          <button
            onClick={() => {
              setProfile(null);
              setOpen(false);
              navigate("/perfiles");
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-hover text-left"
          >
            <LogOut size={16} aria-hidden="true" />
            {t("profiles.exit")}
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const { lang, setLang, t } = useI18n();
  const [langOpen, setLangOpen] = useState(false);
  const current = AVAILABLE_LANGS.find((l) => l.code === lang) ?? AVAILABLE_LANGS[0];

  return (
    <header className="sticky top-0 z-30 bg-base/95 backdrop-blur border-b border-hover">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setLangOpen((o) => !o)}
            className="text-2xl leading-none hover:scale-110 transition-transform"
            aria-label="Cambiar idioma"
          >
            {current.flag}
          </button>
          {langOpen && (
            <div className="absolute left-0 mt-2 w-40 bg-panel border border-hover rounded-xl2 shadow-card p-1 z-20 animate-fadein">
              {AVAILABLE_LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLang(l.code);
                    setLangOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink hover:bg-hover"
                >
                  <span className="text-lg">{l.flag}</span> {l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Link to="/" className="flex items-center gap-2 mr-auto">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6890F0] to-[#F85888] flex items-center justify-center font-display font-bold text-ink">
            P
          </span>
          <span className="font-display font-bold tracking-tight text-lg text-ink">{t("app.name")}</span>
        </Link>

        <Link to="/favoritos" title={t("favorites.title")} aria-label={t("favorites.title")}
              className="rounded-lg p-2 text-ink-soft hover:bg-hover hover:text-ink">
          <Star size={20} aria-hidden="true" />
        </Link>

        <Link to="/sesiones" title={t("sessions.nav")} aria-label={t("sessions.nav")}
              className="rounded-lg p-2 text-ink-soft hover:bg-hover hover:text-ink">
          <Layers size={20} aria-hidden="true" />
        </Link>

        <Link to="/editor" title={t("editor.nav")} aria-label={t("editor.nav")}
              className="rounded-lg p-2 text-ink-soft hover:bg-hover hover:text-ink">
          <SlidersHorizontal size={20} aria-hidden="true" />
        </Link>

        <Link to="/datos" title={t("data.nav")} aria-label={t("data.nav")}
              className="rounded-lg p-2 text-ink-soft hover:bg-hover hover:text-ink">
          <DatabaseBackup size={20} aria-hidden="true" />
        </Link>

        <Link
          to="/equipo"
          className="flex items-center gap-1.5 text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-2 py-1.5 transition-colors text-sm"
          title={t("team.title")}
        >
          <Swords size={16} />
          <span className="hidden sm:inline">{t("team.title")}</span>
        </Link>

        <ModeMenu label={t("nav.mode")} items={["Modo estándar", "Pokémon Champions", "Sesión ROM Hack"]} />

        <Link
          to="/ajustes"
          className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-hover transition-colors"
          aria-label={t("nav.settings")}
          title={t("nav.settings")}
        >
          <Settings size={20} aria-hidden="true" />
        </Link>

        <ProfileMenu />
      </div>
    </header>
  );
}
