import { useState } from "react";
import { Link } from "react-router-dom";
import { Settings, UserCircle2, ChevronDown, Swords } from "lucide-react";
import { useI18n, AVAILABLE_LANGS } from "../i18n";

function ComingSoonMenu({ label, items }: { label: string; items: string[] }) {
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
          <div className="px-3 pt-2 text-[11px] text-ink-soft/70 border-t border-hover mt-1">Disponible en la Fase 2</div>
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

        <Link
          to="/equipo"
          className="flex items-center gap-1.5 text-ink-soft hover:text-ink hover:bg-hover rounded-lg px-2 py-1.5 transition-colors text-sm"
          title={t("team.title")}
        >
          <Swords size={16} />
          <span className="hidden sm:inline">{t("team.title")}</span>
        </Link>

        <ComingSoonMenu label={t("nav.profile")} items={["Perfil 1", "Perfil 2", "+ Nuevo perfil"]} />
        <ComingSoonMenu label={t("nav.mode")} items={["Modo estándar", "Pokémon Champions", "Sesión ROM Hack"]} />

        <button
          className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-hover transition-colors"
          aria-label={t("nav.settings")}
          title={t("nav.settings")}
        >
          <Settings size={20} />
        </button>
        <button
          className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-hover transition-colors"
          aria-label={t("nav.profile")}
          title={t("nav.profile")}
        >
          <UserCircle2 size={22} />
        </button>
      </div>
    </header>
  );
}
