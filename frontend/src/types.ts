export type EffectivenessBucket = {
  multiplier: number;
  label: string;
  key: string;
  types: string[];
};

export type PokeType = {
  id: string;
  name_es: string;
  name_en: string;
  color: string;
};

export type TypeDetail = PokeType & {
  ofensivo: EffectivenessBucket[];
  defensivo: EffectivenessBucket[];
};

export type PokemonSummary = {
  id: number;
  dex: number;
  name_es: string;
  name_en: string;
  generation: number;
};

export type PokemonDetail = PokemonSummary & {
  types: PokeType[];
  abilities: { name_es: string; name_en: string; effect_es: string }[];
  hidden_ability: { name_es: string; name_en: string; effect_es: string } | null;
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  height_m: number;
  weight_kg: number;
  efectividad: EffectivenessBucket[];
};

export type MoveSummary = {
  id: number;
  name_es: string;
  name_en: string;
  type_id: string;
  color: string;
  category: "fisico" | "especial" | "estado";
  power: number | null;
  accuracy: number | null;
  pp: number;
};

export type MoveDetail = MoveSummary & {
  priority: number;
  makes_contact: number;
  generation: number;
  effect_es: string;
  type_name_es: string;
  type_name_en: string;
};

export type AbilitySummary = { id: number; name_es: string; name_en: string };

export type AbilityDetail = AbilitySummary & {
  generation: number;
  effect_es: string;
  pokemon: { id: number; dex: number; name_es: string; is_hidden: number }[];
};

export type SearchResults = {
  pokemon: PokemonSummary[];
  types: PokeType[];
  moves: MoveSummary[];
  abilities: AbilitySummary[];
};