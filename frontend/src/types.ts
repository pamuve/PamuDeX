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

/**
 * Fase 7 — lo añade `middleware/generationMode.js` a TODA ficha de Pokémon,
 * movimiento, habilidad y tipo, haya o no `?gen=`. Es lo que decide si se pinta
 * el `GenerationSelector`: sin cambios registrados no se enseña, para no meter
 * un desplegable inútil en 1.025 fichas.
 *
 * Opcional en el tipo porque una respuesta cacheada por el Service Worker desde
 * antes de la Fase 7 no lo trae.
 */
/**
 * Un cambio histórico de un campo (Tarea 7.2).
 *
 * `generation` es la de ENTRADA EN VIGOR: desde ella el campo vale `new_value`
 * y antes valía `old_value`. `field` es el nombre tal y como lo devuelve la API
 * (`power`, `category`, `types`, `stats.atk`…), con dos formas especiales en los
 * tipos: `relation:<atacante>` cuando el tipo de la ficha es el DEFENSOR, y
 * `relation_out:<defensor>` cuando es el atacante.
 *
 * `old_value` y `new_value` son `unknown` porque no son homogéneos: un número en
 * `power`, una cadena en `category`, un array de ids de tipo en `types`.
 */
export type GenerationalChange = {
  generation: number;
  field: string;
  old_value: unknown;
  new_value: unknown;
  note: string | null;
};

export type WithGenerationalDifferences = {
  has_generational_differences?: boolean;
  /**
   * Viaja EMBEBIDO en la ficha, no en un endpoint aparte: `/api/history` ya es
   * el historial de consultas por perfil (Tarea 5.4), y así las etiquetas
   * funcionan sin conexión con la respuesta que el Service Worker ya cacheó.
   */
  generational_changes?: GenerationalChange[];
};

export type TypeDetail = PokeType &
  WithGenerationalDifferences & {
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

export type PokemonDetail = PokemonSummary &
  WithGenerationalDifferences & {
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

export type MoveDetail = MoveSummary &
  WithGenerationalDifferences & {
    priority: number;
    makes_contact: number | null;
    generation: number;
    effect_es: string;
    type_name_es: string;
    type_name_en: string;
  };

export type AbilitySummary = { id: number; name_es: string; name_en: string };

export type AbilityDetail = AbilitySummary &
  WithGenerationalDifferences & {
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

/**
 * Objetos (Tarea 6.0). El listado NO trae `effect_es`: son 2151 entradas y el
 * texto es casi todo el peso; la descripción llega con la ficha.
 *
 * `category` es la de PokeAPI en inglés (`held-items`, `mega-stones`, `berries`…),
 * 54 en total. No hay campo «equipable»: PokeAPI no lo sabe (el Chaleco Asalto
 * llega sin atributos y la Poción sí trae `holdable`), así que separar objetos
 * de combate del resto se hace por categoría.
 */
export type ItemSummary = {
  id: number;
  name_es: string;
  name_en: string;
  category: string | null;
};

export type ItemDetail = ItemSummary & { effect_es: string | null };

export type ItemCategory = { category: string; total: number };

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
  /**
   * Id del movimiento, NO su nombre. Guardar aquí el `name_es` —como se hacía
   * antes— dejaba las recomendaciones en español para siempre: `lib/recommendation.ts`
   * es una función pura sin acceso a `useI18n`, así que el nombre lo resuelve
   * quien pinta (`RecommendationCard`), que sí conoce el idioma.
   */
  moveId?: number;
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
