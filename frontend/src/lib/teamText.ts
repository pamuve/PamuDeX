/**
 * PamuDeX — Fase 9
 * Equipos en texto: importar y exportar en formato Pokémon Showdown y en un
 * formato propio de una línea por Pokémon.
 *
 * SHOWDOWN (el que usan Showdown, Smogon y casi todos los generadores):
 *
 *     Pikachu @ Light Ball
 *     Ability: Static
 *     Timid Nature
 *     - Thunderbolt
 *     - Volt Switch
 *
 * Los nombres van en inglés. Se leen también el mote (`Chispas (Pikachu)`), el
 * género (`(M)`) y las líneas de EVs, IVs, nivel o teratipo, que se ignoran: el
 * comparador no las usa.
 *
 * PAMUDEX, para escribir un equipo a mano en una nota o un mensaje:
 *
 *     Pikachu | Bola Luminosa | Elec. Estática | Miedosa | Rayo, Voltiocambio
 *
 * Pokémon | objeto | habilidad | naturaleza | movimientos. Solo el primero es
 * obligatorio, y los nombres valen en español o en inglés.
 *
 * EL EQUIPO GUARDA IDS Y `name_es` (ver `TeamSlot`), así que importar es
 * resolver nombres contra el catálogo del modo activo. La comparación ignora
 * mayúsculas, tildes y signos: «Mr. Mime», «mr mime» y «MR.MIME» son lo mismo.
 * Lo que no se reconoce no rompe la importación: se omite y se devuelve en
 * `warnings` para enseñárselo al usuario.
 */
import { NATURES, MAX_MOVES_PER_SLOT, MAX_TEAM_SIZE } from "./team";
import { normalizar } from "./search";
import type { AbilitySummary, ItemSummary, MoveSummary, PokemonDetail, PokemonSummary, RivalSlot, TeamSlot } from "../types";

export type TeamTextFormat = "showdown" | "pamudex";

export interface Catalog {
  pokemon: PokemonSummary[];
  moves: MoveSummary[];
  items: ItemSummary[];
  abilities: AbilitySummary[];
}

export interface ParsedTeam {
  slots: TeamSlot[];
  /** Nombres que no se han reconocido, tal como venían en el texto. */
  warnings: string[];
}

/** Clave de comparación: sin tildes, sin mayúsculas y solo letras y números. */
const clave = (texto: string) => normalizar(texto).replace(/[^a-z0-9]/g, "");

interface Named {
  name_es: string;
  name_en?: string | null;
}

function indice<T extends Named>(lista: T[]): Map<string, T> {
  const mapa = new Map<string, T>();
  for (const x of lista) {
    // El español se registra después: si un nombre coincide en los dos idiomas
    // con entradas distintas, manda el del catálogo en español.
    if (x.name_en) mapa.set(clave(x.name_en), x);
  }
  for (const x of lista) mapa.set(clave(x.name_es), x);
  return mapa;
}

function buscadores(cat: Catalog) {
  const pokemon = indice(cat.pokemon);
  const moves = indice(cat.moves);
  const items = indice(cat.items);
  const abilities = indice(cat.abilities);
  const natures = indice(NATURES);

  return {
    /**
     * Showdown nombra las formas con sufijo (`Raichu-Alola`, `Charizard-Mega-X`).
     * El catálogo va por especie, así que si el nombre entero no existe se
     * prueba quitando sufijos por la derecha. Primero el nombre entero: «Ho-Oh»
     * y «Porygon-Z» llevan guion y son especies.
     */
    pokemon(nombre: string): PokemonSummary | undefined {
      const directo = pokemon.get(clave(nombre));
      if (directo) return directo;
      const partes = nombre.split("-");
      for (let n = partes.length - 1; n >= 1; n--) {
        const hallado = pokemon.get(clave(partes.slice(0, n).join("-")));
        if (hallado) return hallado;
      }
      return undefined;
    },
    move: (nombre: string) => moves.get(clave(nombre.replace(/\[.*?\]/g, ""))),
    item: (nombre: string) => items.get(clave(nombre)),
    ability: (nombre: string) => abilities.get(clave(nombre)),
    nature: (nombre: string) => natures.get(clave(nombre)),
  };
}

type Buscadores = ReturnType<typeof buscadores>;

interface Crudo {
  pokemon: string;
  item: string;
  ability: string;
  nature: string;
  moves: string[];
}

function resolver(crudos: Crudo[], b: Buscadores): ParsedTeam {
  const warnings: string[] = [];
  const slots: TeamSlot[] = [];

  for (const c of crudos) {
    if (slots.length >= MAX_TEAM_SIZE) {
      warnings.push(c.pokemon);
      continue;
    }
    const poke = b.pokemon(c.pokemon);
    if (!poke) {
      warnings.push(c.pokemon);
      continue;
    }
    const item = c.item ? b.item(c.item) : undefined;
    if (c.item && !item) warnings.push(c.item);
    const ability = c.ability ? b.ability(c.ability) : undefined;
    if (c.ability && !ability) warnings.push(c.ability);
    const nature = c.nature ? b.nature(c.nature) : undefined;
    if (c.nature && !nature) warnings.push(c.nature);

    const moveIds: number[] = [];
    for (const nombre of c.moves) {
      const move = b.move(nombre);
      if (!move) warnings.push(nombre);
      else if (!moveIds.includes(move.id) && moveIds.length < MAX_MOVES_PER_SLOT) moveIds.push(move.id);
    }

    slots.push({
      pokemonId: poke.id,
      item: item ? item.name_es : "",
      ability: ability ? ability.name_es : "",
      nature: nature ? nature.name_es : "Fuerte",
      moveIds,
    });
  }
  return { slots, warnings };
}

/* --------------------------------- lectura -------------------------------- */

function leerShowdown(texto: string): Crudo[] {
  const crudos: Crudo[] = [];
  for (const bloque of texto.split(/\n\s*\n/)) {
    const lineas = bloque.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lineas.length) continue;

    // Primera línea: `Mote (Especie) (M) @ Objeto`.
    const [cabecera, ...objeto] = lineas[0].split(" @ ");
    let especie = cabecera.replace(/\s*\((M|F)\)\s*$/i, "").trim();
    const conMote = /\(([^()]+)\)\s*$/.exec(especie);
    if (conMote) especie = conMote[1].trim();

    const crudo: Crudo = { pokemon: especie, item: objeto.join(" @ ").trim(), ability: "", nature: "", moves: [] };
    for (const linea of lineas.slice(1)) {
      if (/^[-–•]\s*/.test(linea)) crudo.moves.push(linea.replace(/^[-–•]\s*/, "").trim());
      else if (/^ability\s*:/i.test(linea)) crudo.ability = linea.replace(/^ability\s*:/i, "").trim();
      else if (/\snature$/i.test(linea)) crudo.nature = linea.replace(/\snature$/i, "").trim();
      // EVs, IVs, Level, Shiny, Tera Type, Happiness…: no se usan.
    }
    if (crudo.pokemon) crudos.push(crudo);
  }
  return crudos;
}

function leerPamudex(texto: string): Crudo[] {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((linea) => {
      const [pokemon = "", item = "", ability = "", nature = "", moves = ""] = linea.split("|").map((x) => x.trim());
      return {
        pokemon,
        item,
        ability,
        nature,
        moves: moves.split(/[,/]/).map((m) => m.trim()).filter(Boolean),
      };
    })
    .filter((c) => c.pokemon);
}

/** Adivina el formato: las líneas `- Movimiento` y `Ability:` solo existen en Showdown. */
export function detectFormat(texto: string): TeamTextFormat {
  if (/^\s*[-–•]\s*\S/m.test(texto) || /^\s*ability\s*:/im.test(texto) || /\snature\s*$/im.test(texto)) {
    return "showdown";
  }
  return texto.includes("|") ? "pamudex" : "showdown";
}

export function parseTeam(texto: string, cat: Catalog): ParsedTeam {
  const limpio = texto.replace(/\r/g, "");
  const crudos = detectFormat(limpio) === "showdown" ? leerShowdown(limpio) : leerPamudex(limpio);
  return resolver(crudos, buscadores(cat));
}

/** Un equipo rival a partir de uno leído: los movimientos entran como «conocidos». */
export function toRivalSlots(slots: TeamSlot[]): RivalSlot[] {
  return slots.map((s) => ({
    pokemonId: s.pokemonId,
    item: s.item,
    ability: s.ability,
    knownMoveIds: s.moveIds,
    suspectedMoveIds: [],
  }));
}

/* -------------------------------- escritura ------------------------------- */

/** Lo mínimo de un hueco para escribirlo, valga para el equipo propio o el rival. */
export interface SlotForText {
  pokemonId: number;
  item: string;
  ability: string;
  nature?: string;
  moveIds: number[];
}

export function serializeTeam(
  slots: SlotForText[],
  format: TeamTextFormat,
  ctx: {
    pokemonById: Record<number, PokemonDetail>;
    pokemon: PokemonSummary[];
    moves: MoveSummary[];
    items: ItemSummary[];
    /** Nombre en el idioma activo, para el formato propio. Showdown va siempre en inglés. */
    name: (o: Named) => string;
  }
): string {
  const ingles = (o: Named) => o.name_en || o.name_es;
  const nombre = format === "showdown" ? ingles : ctx.name;
  const moves = new Map(ctx.moves.map((m) => [m.id, m]));
  const resumen = new Map(ctx.pokemon.map((p) => [p.id, p]));

  const bloques = slots.map((slot) => {
    const poke: Named | undefined = ctx.pokemonById[slot.pokemonId] || resumen.get(slot.pokemonId);
    if (!poke) return null;

    const item = slot.item ? ctx.items.find((i) => i.name_es === slot.item) : undefined;
    // La habilidad se guarda como `name_es`; su nombre en el otro idioma está
    // en la ficha del Pokémon.
    const detalle = ctx.pokemonById[slot.pokemonId];
    const habilidades = detalle ? [...detalle.abilities, ...(detalle.hidden_ability ? [detalle.hidden_ability] : [])] : [];
    const ability = slot.ability ? habilidades.find((a) => a.name_es === slot.ability) : undefined;
    const nature = slot.nature ? NATURES.find((n) => n.name_es === slot.nature) : undefined;
    const nombresMov = slot.moveIds.map((id) => moves.get(id)).filter((m): m is MoveSummary => Boolean(m)).map(nombre);

    const txtItem = item ? nombre(item) : slot.item;
    const txtAbility = ability ? nombre(ability) : slot.ability;

    if (format === "pamudex") {
      return [nombre(poke), txtItem, txtAbility, nature ? nombre(nature) : "", nombresMov.join(", ")]
        .join(" | ")
        .replace(/(\s\|\s)+$/, ""); // sin campos vacíos colgando al final
    }
    const lineas = [txtItem ? `${nombre(poke)} @ ${txtItem}` : nombre(poke)];
    if (txtAbility) lineas.push(`Ability: ${txtAbility}`);
    if (nature) lineas.push(`${nombre(nature)} Nature`);
    for (const m of nombresMov) lineas.push(`- ${m}`);
    return lineas.join("\n");
  });

  return bloques.filter(Boolean).join(format === "showdown" ? "\n\n" : "\n");
}
