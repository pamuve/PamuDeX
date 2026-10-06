/**
 * PamuDeX — navegación principal: definición de los destinos y barra inferior
 * para móvil y tableta.
 *
 * POR QUÉ ABAJO
 * -------------
 * Antes, por debajo de `lg` los seis destinos iban en una fila desplazable
 * bajo la barra superior: arriba del todo, fuera del alcance del pulgar, y con
 * la mitad escondida sin ninguna pista de que hubiera más. Abajo caben los
 * tres de uso diario y «Más» agrupa el resto, todo a una mano.
 *
 * Los destinos se definen aquí una sola vez. La barra superior de escritorio
 * pinta `NAV_PRIMARY` + `NAV_WORK`; el «Más» de aquí, `NAV_WORK` + `NAV_PROFILE`.
 * Historial y ajustes no van en la barra de escritorio porque allí están en el
 * menú del perfil, que es de quien son.
 */

import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  DatabaseBackup,
  History,
  Layers,
  MoreHorizontal,
  Settings,
  SlidersHorizontal,
  Star,
  Swords,
} from "lucide-react";
import { useMenu } from "../hooks/useMenu";
import { useI18n } from "../i18n";

export interface NavItem {
  to: string;
  Icon: LucideIcon;
  labelKey: string;
  /** Otras rutas que cuentan como «estar aquí» (la ficha de un Pokémon es
   *  parte de la Pokédex). */
  also?: string[];
}

export const NAV_PRIMARY: NavItem[] = [
  { to: "/", Icon: BookOpen, labelKey: "nav.pokedex", also: ["/pokemon/", "/tipo/", "/movimiento/", "/habilidad/"] },
  { to: "/equipo", Icon: Swords, labelKey: "team.nav" },
  { to: "/favoritos", Icon: Star, labelKey: "favorites.title" },
];

export const NAV_WORK: NavItem[] = [
  { to: "/sesiones", Icon: Layers, labelKey: "sessions.nav" },
  { to: "/editor", Icon: SlidersHorizontal, labelKey: "editor.nav" },
  { to: "/datos", Icon: DatabaseBackup, labelKey: "data.nav" },
];

export const NAV_PROFILE: NavItem[] = [
  { to: "/historial", Icon: History, labelKey: "history.title" },
  { to: "/ajustes", Icon: Settings, labelKey: "nav.settings" },
];

const NAV_MORE = [...NAV_WORK, ...NAV_PROFILE];

/** ¿Está la ruta actual dentro de este destino? */
export function isActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/" || (item.also ?? []).some((p) => pathname.startsWith(p));
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

const ITEM =
  "pressable relative flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[3.25rem] rounded-full " +
  "px-1 text-[0.6875rem] font-medium tracking-[0.01em]";

/**
 * La «lente» que marca el destino activo: una cápsula de luz dentro del vidrio
 * de la barra, como en la barra de pestañas de iOS 26.
 *
 * No se enciende de golpe: crece desde el centro con el muelle
 * (`--ease-spring`), así el cambio de pestaña se ve como un movimiento hacia el
 * destino y no como un parpadeo. Al ser una transición, si se cambia de
 * pestaña a mitad arranca desde donde esté.
 */
function Lens({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-0 rounded-full bg-ink/10 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]
                  transition-[transform,opacity] duration-[var(--dur-spring)] ease-[var(--ease-spring)] ${
                    active ? "scale-100 opacity-100" : "scale-75 opacity-0"
                  }`}
    />
  );
}

function Contenido({ Icon, active, label }: { Icon: LucideIcon; active: boolean; label: string }) {
  return (
    <>
      <Lens active={active} />
      <Icon size={20} strokeWidth={active ? 2.25 : 1.75} className="relative" aria-hidden="true" />
      <span className="relative">{label}</span>
    </>
  );
}

export function BottomNav() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const menu = useMenu();
  const enMas = NAV_MORE.some((item) => isActive(item, pathname));

  return (
    /*
      Cápsula de vidrio que FLOTA sobre el contenido, separada de los bordes,
      en vez de una franja pegada abajo: el contenido sigue viéndose alrededor
      y por debajo, y queda a la altura del pulgar. `glass-host` (vidrio en un
      pseudoelemento) porque lleva el menú «Más» dentro: ver `index.css`.
    */
    <nav
      aria-label={t("nav.primary")}
      className="glass-host fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 mx-auto
                 max-w-md rounded-full lg:hidden"
    >
      <ul className="flex p-1">
        {NAV_PRIMARY.map((item) => {
          const active = isActive(item, pathname);
          return (
            <li key={item.to} className="flex flex-1">
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`${ITEM} ${active ? "text-ink" : "text-ink-soft hover:text-ink"}`}
              >
                <Contenido Icon={item.Icon} active={active} label={t(item.labelKey)} />
              </Link>
            </li>
          );
        })}

        <li className="relative flex flex-1">
          <button
            ref={menu.triggerRef}
            type="button"
            onClick={menu.toggle}
            onKeyDown={menu.onTriggerKeyDown}
            aria-haspopup="menu"
            aria-expanded={menu.open}
            aria-label={t("nav.moreLabel")}
            className={`${ITEM} ${enMas || menu.open ? "text-ink" : "text-ink-soft hover:text-ink"}`}
          >
            <Contenido Icon={MoreHorizontal} active={enMas || menu.open} label={t("nav.more")} />
          </button>

          {menu.mounted && (
            <div
              ref={menu.menuRef}
              data-state={menu.state}
              aria-hidden={menu.open ? undefined : true}
              onKeyDown={menu.onMenuKeyDown}
              role="menu"
              aria-label={t("nav.moreLabel")}
              // Sale de «Más» y crece hacia arriba y a la izquierda, hacia
              // donde hay sitio: el origen es la esquina del botón que lo abre.
              className="popover absolute bottom-full right-0 mb-3 w-56 origin-bottom-right p-1.5"
            >
              {NAV_MORE.map((item, i) => {
                const active = isActive(item, pathname);
                return (
                  <Fragment key={item.to}>
                    {i === NAV_WORK.length && (
                      <div role="separator" className="mx-2 my-1.5 border-t border-ink/10" />
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      aria-current={active ? "page" : undefined}
                      onClick={() => {
                        // Sin devolver el foco: la navegación lo lleva al
                        // contenido de la página nueva (ver App.tsx).
                        menu.close(false);
                        navigate(item.to);
                      }}
                      className={`glass-item ${active ? "bg-ink/10" : ""}`}
                    >
                      <item.Icon size={18} className="text-ink-soft" aria-hidden="true" />
                      {t(item.labelKey)}
                    </button>
                  </Fragment>
                );
              })}
            </div>
          )}
        </li>
      </ul>
    </nav>
  );
}
