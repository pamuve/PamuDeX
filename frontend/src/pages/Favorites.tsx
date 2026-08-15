/**
 * PamuDeX — Tarea 5.3
 * Página /favoritos: lo marcado por el perfil activo, agrupado por tipo.
 *
 * LOS NOMBRES SE RESUELVEN AQUÍ, NO EN EL BACKEND
 * -----------------------------------------------
 * `/api/favorites` devuelve solo referencias. Los nombres salen de los listados
 * que la app ya pide (y que el Service Worker cachea), así que pasan por
 * `lib/api.ts` y **respetan los overrides de la sesión de ROM Hack activa**: un
 * Pokémon renombrado en tu ROM Hack aparece aquí con su nombre nuevo. Un JOIN
 * en el backend no daría eso, porque el middleware de overrides no toca
 * /favorites.
 *
 * Solo se piden los listados de los tipos que tienen algún favorito.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, Loader2, UserCircle2 } from "lucide-react";
import { api } from "../lib/api";
import { useAllFavorites, type FavoriteType } from "../lib/favorites";
import { useActiveProfile } from "../lib/profile";
import { useI18n } from "../i18n";
import type { PokeType } from "../types";

/** Un nombre resuelto y su ruta. */
interface Entry {
  ref: string;
  name: string;
  to: string;
  color?: string;
}

const ROUTE: Record<FavoriteType, string> = {
  pokemon: "/pokemon",
  move: "/movimiento",
  ability: "/habilidad",
  type: "/tipo",
};

export default function Favorites() {
  const { t, lang } = useI18n();
  const [profile] = useActiveProfile();
  const favorites = useAllFavorites();

  const [entries, setEntries] = useState<Record<FavoriteType, Entry[]>>({
    pokemon: [],
    move: [],
    ability: [],
    type: [],
  });
  const [resolving, setResolving] = useState(false);

  const key = [
    favorites.pokemon.join(","),
    favorites.move.join(","),
    favorites.ability.join(","),
    favorites.type.join(","),
  ].join("|");

  useEffect(() => {
    if (!favorites.ready) return;

    let cancelled = false;
    const nombre = (o: { name_es: string; name_en: string }) =>
      lang === "en" ? o.name_en : o.name_es;

    async function resolve() {
      setResolving(true);
      const next: Record<FavoriteType, Entry[]> = {
        pokemon: [],
        move: [],
        ability: [],
        type: [],
      };

      try {
        // Solo se pide el listado de los tipos que tienen algo marcado.
        const tareas: Promise<void>[] = [];

        if (favorites.pokemon.length) {
          tareas.push(
            api.pokemon.list().then((list) => {
              const byId = new Map(list.map((p) => [String(p.id), p]));
              next.pokemon = favorites.pokemon.map((ref) => {
                const found = byId.get(ref);
                return {
                  ref,
                  name: found ? nombre(found) : `#${ref}`,
                  to: `${ROUTE.pokemon}/${ref}`,
                };
              });
            })
          );
        }
        if (favorites.move.length) {
          tareas.push(
            api.moves.list().then((list) => {
              const byId = new Map(list.map((m) => [String(m.id), m]));
              next.move = favorites.move.map((ref) => {
                const found = byId.get(ref);
                return {
                  ref,
                  name: found ? nombre(found) : `#${ref}`,
                  to: `${ROUTE.move}/${ref}`,
                  color: found ? found.color : undefined,
                };
              });
            })
          );
        }
        if (favorites.ability.length) {
          tareas.push(
            api.abilities.list().then((list) => {
              const byId = new Map(list.map((a) => [String(a.id), a]));
              next.ability = favorites.ability.map((ref) => {
                const found = byId.get(ref);
                return {
                  ref,
                  name: found ? nombre(found) : `#${ref}`,
                  to: `${ROUTE.ability}/${ref}`,
                };
              });
            })
          );
        }
        if (favorites.type.length) {
          tareas.push(
            api.types.list().then((list: PokeType[]) => {
              const byId = new Map(list.map((tp) => [tp.id, tp]));
              next.type = favorites.type.map((ref) => {
                const found = byId.get(ref);
                return {
                  ref,
                  name: found ? nombre(found) : ref,
                  to: `${ROUTE.type}/${ref}`,
                  color: found ? found.color : undefined,
                };
              });
            })
          );
        }

        await Promise.all(tareas);
      } catch {
        // Sin conexión y sin caché: se muestran las referencias en crudo, que
        // siguen siendo enlaces válidos. Mejor eso que una página vacía.
      }

      if (!cancelled) {
        setEntries(next);
        setResolving(false);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, favorites.ready, lang]);

  // Sin perfil no hay favoritos que enseñar.
  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <UserCircle2 size={40} className="mx-auto text-ink-soft mb-3" aria-hidden="true" />
        <h1 className="font-display font-bold text-2xl text-ink mb-2">{t("favorites.title")}</h1>
        <p className="text-ink-soft mb-5">{t("favorites.needProfile")}</p>
        <Link
          to="/perfiles"
          className="inline-block bg-panel hover:bg-hover text-ink rounded-lg px-5 py-2.5 text-sm transition-colors"
        >
          {t("profiles.choose")}
        </Link>
      </div>
    );
  }

  const groups: { type: FavoriteType; label: string }[] = [
    { type: "pokemon", label: t("favorites.pokemon") },
    { type: "move", label: t("favorites.moves") },
    { type: "ability", label: t("favorites.abilities") },
    { type: "type", label: t("favorites.types") },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-ink">{t("favorites.title")}</h1>
        <p className="text-ink-soft text-sm mt-1">
          {t("favorites.subtitle", { name: profile.name })}
        </p>
      </div>

      {!favorites.ready || resolving ? (
        <div className="flex items-center justify-center gap-2 text-ink-soft py-12">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          {t("favorites.loading")}
        </div>
      ) : favorites.total === 0 ? (
        <div className="bg-panel rounded-xl2 shadow-card p-8 text-center animate-fadein">
          <Star size={36} className="mx-auto text-ink-soft mb-3" aria-hidden="true" />
          <p className="text-ink font-medium mb-1">{t("favorites.empty")}</p>
          <p className="text-ink-soft text-sm">{t("favorites.emptyHint")}</p>
        </div>
      ) : (
        groups.map((group) => {
          const items = entries[group.type];
          if (!items.length) return null;
          return (
            <section key={group.type} className="animate-fadein">
              <h2 className="font-display text-sm tracking-widest text-ink-soft uppercase mb-3">
                {group.label} ({items.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                  <Link
                    key={item.ref}
                    to={item.to}
                    className="flex items-center gap-2 bg-panel hover:bg-hover rounded-xl2 shadow-card px-4 py-3 text-ink text-sm transition-colors"
                  >
                    {item.color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                    )}
                    {item.name}
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
