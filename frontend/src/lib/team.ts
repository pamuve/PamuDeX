import { Team, RivalTeam, TeamSlot, RivalSlot, Nature } from "../types";

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

export function loadTeam(): Team {
  return safeParse<Team>(localStorage.getItem(TEAM_KEY), { slots: [] });
}
export function saveTeam(team: Team) {
  localStorage.setItem(TEAM_KEY, JSON.stringify(team));
}

export function loadRivalTeam(): RivalTeam {
  return safeParse<RivalTeam>(localStorage.getItem(RIVAL_KEY), { slots: [] });
}
export function saveRivalTeam(team: RivalTeam) {
  localStorage.setItem(RIVAL_KEY, JSON.stringify(team));
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
