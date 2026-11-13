import { Team, RivalTeam, TeamSlot, RivalSlot, Nature } from "../types";
import { getActiveProfileId } from "./profile";
import { currentScope } from "./scope";

const TEAM_KEY = "pamudex_team_own";
const RIVAL_KEY = "pamudex_team_rival";
export const MAX_TEAM_SIZE = 6;
export const MAX_MOVES_PER_SLOT = 4;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * EL EQUIPO EN USO ES POR PERFIL Y POR JUEGO (Fase 9).
 *
 * Antes había una sola clave para todo el aparato: el equipo de un perfil lo
 * veía el siguiente, y el de un ROM Hack aparecía en otro con ids que allí
 * podían no significar lo mismo. Ahora la clave lleva el perfil y el ámbito
 * (`lib/scope.ts`).
 *
 * El equipo que hubiera en la clave antigua NO se pierde: se lee como reserva
 * la primera vez que un perfil abre el comparador sin sesión, y a partir de
 * ahí manda la clave nueva.
 */
function claves(): { own: string; rival: string; legado: boolean } {
  const sufijo = `:${getActiveProfileId() ?? 0}:${currentScope()}`;
  return { own: TEAM_KEY + sufijo, rival: RIVAL_KEY + sufijo, legado: currentScope() === "global" };
}

function leer<T>(clave: string, antigua: string, legado: boolean, vacio: T): T {
  try {
    const propio = localStorage.getItem(clave);
    if (propio) return safeParse<T>(propio, vacio);
    return legado ? safeParse<T>(localStorage.getItem(antigua), vacio) : vacio;
  } catch {
    return vacio;
  }
}

function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* almacenamiento lleno o bloqueado: el equipo dura lo que dure la página */
  }
}

export function loadTeam(): Team {
  const k = claves();
  return leer<Team>(k.own, TEAM_KEY, k.legado, { slots: [] });
}

export function saveTeam(team: Team) {
  guardar(claves().own, team);
}

export function loadRivalTeam(): RivalTeam {
  const k = claves();
  return leer<RivalTeam>(k.rival, RIVAL_KEY, k.legado, { slots: [] });
}

export function saveRivalTeam(team: RivalTeam) {
  guardar(claves().rival, team);
}

export function emptyTeamSlot(pokemonId: number): TeamSlot {
  return { pokemonId, item: "", ability: "", nature: "Fuerte", moveIds: [] };
}
export function emptyRivalSlot(pokemonId: number): RivalSlot {
  return { pokemonId, item: "", ability: "", knownMoveIds: [], suspectedMoveIds: [] };
}

// Tabla oficial de las 25 naturalezas (sube un 10% una estadística, baja un 10% otra; 5 son neutras)
export const NATURES: Nature[] = [
  { name_es: "Fuerte", name_en: "Hardy", boosts: null, hinders: null },
  { name_es: "Solitaria", name_en: "Lonely", boosts: "atk", hinders: "def" },
  { name_es: "Audaz", name_en: "Brave", boosts: "atk", hinders: "spe" },
  { name_es: "Firme", name_en: "Adamant", boosts: "atk", hinders: "spa" },
  { name_es: "Pícara", name_en: "Naughty", boosts: "atk", hinders: "spd" },
  { name_es: "Osada", name_en: "Bold", boosts: "def", hinders: "atk" },
  { name_es: "Dócil", name_en: "Docile", boosts: null, hinders: null },
  { name_es: "Plácida", name_en: "Relaxed", boosts: "def", hinders: "spe" },
  { name_es: "Agitada", name_en: "Impish", boosts: "def", hinders: "spa" },
  { name_es: "Floja", name_en: "Lax", boosts: "def", hinders: "spd" },
  { name_es: "Miedosa", name_en: "Timid", boosts: "spe", hinders: "atk" },
  { name_es: "Activa", name_en: "Hasty", boosts: "spe", hinders: "def" },
  { name_es: "Seria", name_en: "Serious", boosts: null, hinders: null },
  { name_es: "Alegre", name_en: "Jolly", boosts: "spe", hinders: "spa" },
  { name_es: "Ingenua", name_en: "Naive", boosts: "spe", hinders: "spd" },
  { name_es: "Modesta", name_en: "Modest", boosts: "spa", hinders: "atk" },
  { name_es: "Suave", name_en: "Mild", boosts: "spa", hinders: "def" },
  { name_es: "Tranquila", name_en: "Quiet", boosts: "spa", hinders: "spe" },
  { name_es: "Tímida", name_en: "Bashful", boosts: null, hinders: null },
  { name_es: "Alocada", name_en: "Rash", boosts: "spa", hinders: "spd" },
  { name_es: "Serena", name_en: "Calm", boosts: "spd", hinders: "atk" },
  { name_es: "Amable", name_en: "Gentle", boosts: "spd", hinders: "def" },
  { name_es: "Grosera", name_en: "Sassy", boosts: "spd", hinders: "spe" },
  { name_es: "Cauta", name_en: "Careful", boosts: "spd", hinders: "spa" },
  { name_es: "Rara", name_en: "Quirky", boosts: null, hinders: null },
];
