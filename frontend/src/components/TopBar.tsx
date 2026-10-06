import type { CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Settings,
  UserCircle2,
  ChevronDown,
  Users,
  LogOut,
  History,
  Shield,
  Gamepad2,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { useMenu } from "../hooks/useMenu";
import { useI18n, AVAILABLE_LANGS } from "../i18n";
import { useActiveProfile, profileInitial } from "../lib/profile";
import { readableInk } from "../lib/theme";
import { useActiveChampions } from "../lib/champions";
import { useActiveSession } from "../lib/session";
import { NAV_PRIMARY, NAV_WORK, isActive } from "./BottomNav";

/**
 * Destinos de la barra de escritorio (`lg` en adelante). Por debajo van en
 * `BottomNav`, que es donde se definen. Historial y ajustes no están aquí: son
 * del perfil y viven en su menú.
 */
const NAV_DESKTOP = [...NAV_PRIMARY, ...NAV_WORK];

/** Opciones de los menús desplegables de la barra: 44px de alto mínimo. */
const MENU_ITEM = "glass-item";

/** Botones de la barra que abren un menú. */
const BAR_BUTTON =
  "pressable flex items-center gap-1.5 min-h-[2.5rem] rounded-full px-2.5 text-ink-soft hover:text-ink hover:bg-ink/10";

/** Panel de un menú desplegable, anclado a la esquina de su botón. */
const MENU_PANEL =
  "popover absolute right-0 mt-3 origin-top-right p-1.5 z-20";

/**
 * Menú «Modo» (Tarea 6.3): desde aquí se entra en Pokémon Champions y se vuelve
 * a la Pokédex estándar.
 *
 * La sesión de ROM Hack aparece aquí solo como información: se elige en
 * `/sesiones`, que está en la navegación principal y por eso aquí no se repite.
 * Entrar en Champions la pausa porque los dos modos son excluyentes.
 */
function ModeMenu({ label }: { label: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const menu = useMenu();
  const { champions, exit } = useActiveChampions();
  const [sessionId] = useActiveSession();

  /** Ir a una ruta cerrando el menú. Sin devolver el foco: la navegación
   *  ya lo lleva al contenido de la página nueva (ver App.tsx). */
  function ir(ruta: string) {
    menu.close(false);
    navigate(ruta);
  }

  const modoActual = champions
    ? t("mode.champions")
    : sessionId !== null
      ? t("mode.session")
      : t("mode.standard");

  return (
    <div className="relative">
      <button
        ref={menu.triggerRef}
        onClick={menu.toggle}
        onKeyDown={menu.onTriggerKeyDown}
        className={BAR_BUTTON}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={label}
        title={label}
      >
        {/* Por debajo de `sm` el rótulo se queda en icono: son los 40px que le
            faltaban al distintivo de Champions para no truncarse en 360px. */}
        <Gamepad2 size={18} className="sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline text-sm">{label}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {menu.mounted && (
        <div
          ref={menu.menuRef}
          data-state={menu.state}
          aria-hidden={menu.open ? undefined : true}
          onKeyDown={menu.onMenuKeyDown}
          role="menu"
          aria-label={label}
          className={`${MENU_PANEL} w-64`}
        >
          <p className="px-3 pt-1.5 pb-2 mb-1.5 text-xs text-ink-soft border-b border-ink/10">
            {t("mode.current", { name: modoActual })}
          </p>

          {champions ? (
            <button
              role="menuitem"
              onClick={() => {
                exit();
                ir("/");
              }}
              className={MENU_ITEM}
            >
              <LogOut size={16} className="text-ink-soft" aria-hidden="true" />
              {t("mode.exitChampions")}
            </button>
          ) : (
            <button role="menuitem" onClick={() => ir("/champions")} className={MENU_ITEM}>
              <Shield size={16} className="text-ink-soft" aria-hidden="true" />
              {t("mode.enterChampions")}
            </button>
          )}

          <Link
            to="/champions/reglas"
            role="menuitem"
            onClick={() => menu.close(false)}
            className={MENU_ITEM}
          >
            <SlidersHorizontal size={16} className="text-ink-soft" aria-hidden="true" />
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
      className="pressable glass flex items-center gap-1.5 min-h-[2.5rem] rounded-full px-3 border border-warning/40
                 text-ink text-xs sm:text-sm transition-colors hover:bg-warning/25 min-w-0 max-w-full"
    >
      <Shield size={14} className="shrink-0 text-warning" aria-hidden="true" />
      <span className="font-display font-semibold truncate">{t("mode.champions")}</span>
      <span className="hidden sm:inline text-ink-soft max-w-[8rem] truncate">· {champions.name}</span>
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
  const menu = useMenu();

  function ir(ruta: string) {
    menu.close(false);
    navigate(ruta);
  }

  if (!profile) {
    return (
      <Link to="/perfiles" className={`${BAR_BUTTON} text-sm`} title={t("profiles.title")}>
        <UserCircle2 size={22} aria-hidden="true" />
        <span className="hidden sm:inline">{t("profiles.choose")}</span>
      </Link>
    );
  }

  const color = profile.color || "#7FB4E8";

  return (
    <div className="relative">
      <button
        ref={menu.triggerRef}
        onClick={menu.toggle}
        onKeyDown={menu.onTriggerKeyDown}
        className={`${BAR_BUTTON} px-1.5`}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={t("profiles.activeProfile", { name: profile.name })}
        title={t("profiles.activeProfile", { name: profile.name })}
      >
        <span
          className="color-chip w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0 select-none"
          style={
            { backgroundColor: color, color: readableInk(color), "--chip-color": color } as CSSProperties
          }
          aria-hidden="true"
        >
          {profile.avatar || profileInitial(profile.name)}
        </span>
        {/* El nombre solo cuando sobra sitio: en `lg` la barra ya lleva los
            seis destinos con texto, y el avatar identifica el perfil igual. */}
        <span className="hidden xl:inline text-sm max-w-[8rem] truncate">{profile.name}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {menu.mounted && (
        <div
          ref={menu.menuRef}
          data-state={menu.state}
          aria-hidden={menu.open ? undefined : true}
          onKeyDown={menu.onMenuKeyDown}
          role="menu"
          aria-label={t("profiles.activeProfile", { name: profile.name })}
          className={`${MENU_PANEL} w-56`}
        >
          <p className="px-3 pt-1.5 pb-2 mb-1.5 text-xs text-ink-soft border-b border-ink/10 truncate">
            {t("profiles.activeProfile", { name: profile.name })}
          </p>
          {/* Historial y ajustes viven aquí y no en la barra: son del perfil. */}
          <button role="menuitem" onClick={() => ir("/historial")} className={MENU_ITEM}>
            <History size={16} className="text-ink-soft" aria-hidden="true" />
            {t("history.title")}
          </button>
          <button role="menuitem" onClick={() => ir("/ajustes")} className={MENU_ITEM}>
            <Settings size={16} className="text-ink-soft" aria-hidden="true" />
            {t("nav.settings")}
          </button>
          <div role="separator" className="mx-2 my-1.5 border-t border-ink/10" />
          <button role="menuitem" onClick={() => ir("/perfiles")} className={MENU_ITEM}>
            <Users size={16} className="text-ink-soft" aria-hidden="true" />
            {t("profiles.switch")}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setProfile(null);
              ir("/perfiles");
            }}
            className={MENU_ITEM}
          >
            <LogOut size={16} className="text-ink-soft" aria-hidden="true" />
            {t("profiles.exit")}
          </button>
        </div>
      )}
    </div>
  );
}

/** Selector de idioma. El mismo ajuste está en /ajustes; esto es el atajo. */
function LangMenu() {
  const { lang, setLang, t } = useI18n();
  const menu = useMenu();
  const current = AVAILABLE_LANGS.find((l) => l.code === lang) ?? AVAILABLE_LANGS[0];

  return (
    <div className="relative">
      <button
        ref={menu.triggerRef}
        onClick={menu.toggle}
        onKeyDown={menu.onTriggerKeyDown}
        className={`${BAR_BUTTON} min-w-[2.5rem] justify-center text-lg leading-none`}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        // La bandera es un emoji decorativo: el nombre accesible dice qué
        // idioma hay puesto, no solo que esto cambia el idioma.
        aria-label={t("a11y.changeLanguage", { name: current.label })}
        title={t("a11y.changeLanguage", { name: current.label })}
      >
        <span aria-hidden="true">{current.flag}</span>
      </button>
      {menu.mounted && (
        <div
          ref={menu.menuRef}
          data-state={menu.state}
          aria-hidden={menu.open ? undefined : true}
          onKeyDown={menu.onMenuKeyDown}
          role="menu"
          aria-label={t("settings.language")}
          className={`${MENU_PANEL} w-44`}
        >
          {AVAILABLE_LANGS.map((l) => (
            <button
              key={l.code}
              role="menuitemradio"
              aria-checked={l.code === lang}
              onClick={() => {
                setLang(l.code);
                menu.close();
              }}
              className={MENU_ITEM}
            >
              <span className="text-lg" aria-hidden="true">
                {l.flag}
              </span>
              {l.label}
              {l.code === lang && <Check size={14} className="ml-auto text-accent" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const { t } = useI18n();
  const { pathname } = useLocation();

  return (
    // Sin franja opaca: los controles son cápsulas de vidrio que flotan, y
    // detrás solo hay un velo (`scroll-edge`) que funde el contenido al pasar
    // por debajo. Ver «Borde de desplazamiento» en `index.css`.
    <header className="sticky top-0 z-30 scroll-edge pt-[env(safe-area-inset-top)]">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 h-16 flex items-center gap-2 sm:gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0 rounded-lg" aria-label={t("app.name")}>
          {/* El icono de la app: el mismo del escritorio y de la pantalla de
              inicio. Antes era una «P» sobre un degradado que no era la marca. */}
          <img src="/icons/icon.svg" alt="" width={32} height={32} className="h-8 w-8" />
          {/* Por debajo de `sm` queda solo el icono: el nombre son casi 100px y
              es lo que deja sitio al distintivo de Champions en 360px. */}
          <span className="hidden sm:inline font-display font-bold tracking-tight text-lg text-ink">
            {t("app.name")}
          </span>
        </Link>

        {/*
          Destinos de escritorio, con texto: solo con iconos había que pasar el
          ratón por encima para saber a dónde llevaba cada uno.

          `min-w-0` + `scroll-row` por el escalado de texto (8.1): las media
          queries no ven el `font-size` de la raíz, así que al 130% esta fila
          puede pedir más ancho del que hay. Se desplaza ella en vez de sacar
          scroll horizontal a todo el documento. Por eso no lleva desplegables:
          `overflow-x` los recortaría.
        */}
        {/* `glass` y no `glass-host`: aquí no hay desplegables, y como la
            fila puede desplazarse en horizontal, un vidrio en pseudoelemento
            se desplazaría con ella. */}
        <nav
          aria-label={t("nav.primary")}
          className="glass hidden lg:flex items-center gap-0.5 min-w-0 overflow-x-auto scroll-row ml-2 rounded-full p-1"
        >
          {NAV_DESKTOP.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`pressable shrink-0 flex items-center gap-1.5 min-h-[2.5rem] rounded-full px-3 text-sm ${
                  active
                    ? "bg-ink/10 text-ink font-medium shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]"
                    : "text-ink-soft hover:text-ink hover:bg-ink/10"
                }`}
              >
                <item.Icon size={16} aria-hidden="true" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* Ocupa el hueco flexible: se ve siempre, también en móvil. `min-w-0`
            es lo que le deja encogerse en vez de empujar la fila. */}
        <span className="flex-1 min-w-0 flex justify-end lg:justify-start">
          <ChampionsBadge />
        </span>

        {/* `glass-host`: lleva tres menús dentro y su vidrio tiene que dejar
            que el de ellos desenfoque la página (ver `index.css`). */}
        <span className="glass-host relative shrink-0 flex items-center gap-0.5 rounded-full p-1">
          <ModeMenu label={t("nav.mode")} />
          <LangMenu />
          <ProfileMenu />
        </span>
      </div>
    </header>
  );
}
