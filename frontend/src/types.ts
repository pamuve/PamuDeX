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
  makes_contact: number | null;
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

// ===================== Fase 2: comparador de equipos =====================

export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

export type Nature = {
  name_es: string;
  name_en: string;
  boosts: Exclude<StatKey, "hp"> | null;
  hinders: Exclude<StatKey, "hp"> | null;
};

export type TeamSlot = {
  pokemonId: number; // referencia a PokemonDetail.id
  item: string;
  ability: string; // name_es de una habilidad real del Pokémon (incluida la oculta)
  nature: string; // name_es de una Nature
  moveIds: number[]; // hasta 4 ids de MoveSummary
};

export type Team = {
  slots: TeamSlot[]; // máximo 6
};

export type RivalSlot = {
  pokemonId: number;
  item: string;
  ability: string;
  knownMoveIds: number[];
  suspectedMoveIds: number[];
};

export type RivalTeam = {
  slots: RivalSlot[]; // máximo 6
};

export type DamageEstimate = {
  raw: number;
  percentOfHp: number;
  effectivenessMultiplier: number;
  stab: boolean;
};

export type ReasonType = "resists" | "immune" | "can_hit_hard" | "danger_move" | "outsped" | "faster";

export type Reason = {
  type: ReasonType;
  typeName?: string;
  moveName?: string;
  value?: number; // ej. % de PS
};

export type CandidateScore = {
  pokemonId: number;
  score: number;
  reasons: Reason[];
  dangers: Reason[];
};

export type Recommendation = {
  rivalPokemonId: number;
  ranked: CandidateScore[]; // ordenado de mejor a peor
};

export type CoverageReport = {
  globalWeakness: string[]; // type ids con debilidad compartida por 2+ Pokémon
  noResist: string[]; // type ids que nadie del equipo resiste
  overrepresented: string[]; // type ids del propio equipo que se repiten 3+ veces
  offensiveGaps: string[]; // type ids sin ningún movimiento >= x1 en el equipo
  defensiveHotspots: string[]; // type ids que golpean fuerte a más de la mitad del equipo
};
