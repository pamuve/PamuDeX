import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Settings, UserCircle2, ChevronDown, Swords, Layers, SlidersHorizontal, DatabaseBackup, Users, LogOut, Star, History, Shield } from "lucide-react";
import { useI18n, AVAILABLE_LANGS } from "../i18n";
import { useActiveProfile, profileInitial } from "../lib/profile";
import { useActiveChampions } from "../lib/champions";
import { useActiveSession } from "../lib/session";

/**
 * Menú «Modo» (Tarea 6.3). Deja de ser un marcador de posición: desde aquí se
 * entra en Pokémon Champions y se vuelve a la Pokédex estándar.
 *
 * La sesión de ROM Hack aparece aquí solo como información: se elige en
 * `/sesiones`, y entrar en Champions la pausa porque los dos modos son
 * excluyentes.
 */
function ModeMenu({ label }: { label: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { champions, exit } = useActiveChampions();
  const [sessionId] = useActiveSession();

  const modoActual = champions
    ? t("mode.champions")
    : sessionId !== null
      ? t("mode.session")
      : t("mode.standard");

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
        <div className="absolute right-0 mt-2 w-60 bg-panel border border-hover rounded-xl2 shadow-card p-2 z-20 animate-fadein">
          <p className="px-3 py-1.5 text-[11px] text-ink-soft/70 border-b border-hover mb-1">
            {t("mode.current", { name: modoActual })}
          </p>

          {champions ? (
            <button
              onClick={() => {
                exit();
                setOpen(false);
                navigate("/");
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-hover text-left"
            >
              <LogOut size={16} aria-hidden="true" />
              {t("mode.exitChampions")}
            </button>
          ) : (
            <button
              onClick={() => {
                setOpen(false);
                navigate("/champions");
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-hover text-left"
            >
              <Shield size={16} aria-hidden="true" />
              {t("mode.enterChampions")}
            </button>
          )}

          <button
            onClick={() => {
              setOpen(false);
              navigate("/sesiones");
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-hover text-left"
          >
            <Layers size={16} aria-hidden="true" />
            {t("sessions.nav")}
          </button>

          <Link
            to="/champions/reglas"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-ink-soft hover:bg-hover hover:text-ink border-t border-hover mt-1"
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            {t("champions.title")}
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Distintivo permanente del modo Champions.
 *
 * Criterio de aceptación de la 6.3: tiene que verse siempre y sin ambigüedad en
 * qué modo estás, porque las fichas son las mismas que las de la Pokédex normal
 * y de un vistazo no se distinguirían. Va en la barra, que está en todas las
 * pantallas menos en la de perfiles.
 */
function ChampionsBadge() {
  const { t } = useI18n();
  const { champions } = useActiveChampions();
  if (!champions) return null;

  return (
    <Link
      to="/champions"
      title={t("mode.badgeTitle", { name: champions.name })}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 bg-[#F08030]/20 border border-[#F08030]/50 text-ink text-xs sm:text-sm transition-colors hover:bg-[#F08030]/30"
    >
      <Shield size={14} className="shrink-0" aria-hidden="true" />
      <span className="font-display tracking-wide">{t("mode.champions")}</span>
      <span className="hidden sm:inline text-ink-soft max-w-[8rem] truncate">
        · {champions.name}
      </span>
    </Link>
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

        <Link to="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6890F0] to-[#F85888] flex items-center justify-center font-display font-bold text-ink">
            P
          </span>
          <span className="font-display font-bold tracking-tight text-lg text-ink">{t("app.name")}</span>
        </Link>

        {/* Junto al logo y antes del hueco flexible: se ve siempre, también en
            móvil, que es donde el resto de iconos empieza a apretarse. */}
        <span className="mr-auto">
          <ChampionsBadge />
        </span>

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

        <ModeMenu label={t("nav.mode")} />

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
