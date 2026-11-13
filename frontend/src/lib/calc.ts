/**
 * PamuDeX — Fase 9
 * Calculadora de daño: la fórmula de los juegos (5ª generación en adelante) con
 * nivel, EVs, IVs, naturaleza, cambios de stat, clima, crítico, quemadura,
 * pantalla y objetos.
 *
 * NO SUSTITUYE A `lib/damage.ts`. Aquélla es una ESTIMACIÓN con stats base para
 * ordenar candidatos en el comparador, donde no se conocen EVs ni nivel; ésta
 * calcula el daño real de un golpe concreto y devuelve el rango de los 16
 * valores posibles del factor aleatorio.
 *
 * LA EFECTIVIDAD SALE DE LA FICHA DEL DEFENSOR (`efectividad`), no de una tabla
 * propia: así lleva ya aplicados la tabla de tipos del ROM Hack, la generación
 * elegida y los multiplicadores de Champions, sin que esto sepa nada de modos.
 *
 * LO QUE NO MODELA: habilidades, terreno y efectos especiales de movimientos
 * concretos (golpes múltiples, potencia variable…). La página lo dice.
 */
import type { MoveSummary, PokemonDetail, StatKey, Stats } from "../types";
import { NATURES } from "./team";

export type Weather = "none" | "sun" | "rain";
export type AttackerItem = "none" | "choice" | "lifeOrb" | "expertBelt" | "typeBoost";
export type DefenderItem = "none" | "eviolite" | "assaultVest";

export interface Side {
  pokemon: PokemonDetail;
  level: number;
  nature: string; // name_es de una Nature, como en TeamSlot
  evs: Stats;
  iv: number; // el mismo para todas las stats: afinar una a una no cambia casi nada
  /** Cambio de la stat que interviene: de -6 a +6. */
  stage: number;
}

export interface CalcInput {
  attacker: Side & { item: AttackerItem };
  defender: Side & { item: DefenderItem };
  move: MoveSummary;
  weather: Weather;
  critical: boolean;
  burned: boolean;
  screen: boolean;
}

export interface CalcResult {
  /** Los 16 valores posibles, de menor a mayor. Vacío si el movimiento no hace daño. */
  rolls: number[];
  min: number;
  max: number;
  hp: number;
  minPercent: number;
  maxPercent: number;
  effectiveness: number;
  stab: boolean;
  /** Golpes para debilitar con el peor y con el mejor resultado. Infinity si no hace daño. */
  hitsWorst: number;
  hitsBest: number;
}

export const EMPTY_EVS: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
export const MAX_EV = 252;

function natureMultiplier(nature: string, stat: StatKey): number {
  const n = NATURES.find((x) => x.name_es === nature);
  if (!n) return 1;
  if (n.boosts === stat) return 1.1;
  if (n.hinders === stat) return 0.9;
  return 1;
}

/** La stat real a un nivel dado, con IV, EV y naturaleza. */
export function realStat(side: Side, stat: StatKey): number {
  const base = side.pokemon.stats[stat];
  const comun = Math.floor(((2 * base + side.iv + Math.floor(side.evs[stat] / 4)) * side.level) / 100);
  if (stat === "hp") {
    // Shedinja: siempre 1 PS, digan lo que digan los EVs.
    return base === 1 ? 1 : comun + side.level + 10;
  }
  return Math.floor((comun + 5) * natureMultiplier(side.nature, stat));
}

function stageMultiplier(stage: number): number {
  const s = Math.max(-6, Math.min(6, Math.trunc(stage)));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

function effectivenessAgainst(defender: PokemonDetail, moveTypeId: string): number {
  for (const bucket of defender.efectividad) {
    if (bucket.types.includes(moveTypeId)) return bucket.multiplier;
  }
  return 1;
}

export function calculate(input: CalcInput): CalcResult {
  const { attacker, defender, move } = input;
  const hp = realStat(defender, "hp");
  const effectiveness = effectivenessAgainst(defender.pokemon, move.type_id);
  const stab = attacker.pokemon.types.some((t) => t.id === move.type_id);
  const vacio: CalcResult = {
    rolls: [], min: 0, max: 0, hp, minPercent: 0, maxPercent: 0, effectiveness, stab,
    hitsWorst: Infinity, hitsBest: Infinity,
  };
  if (move.category === "estado" || !move.power || effectiveness === 0) return vacio;

  const fisico = move.category === "fisico";
  const statAtaque: StatKey = fisico ? "atk" : "spa";
  const statDefensa: StatKey = fisico ? "def" : "spd";

  // Un golpe crítico ignora las bajadas de ataque propias y las subidas de
  // defensa del rival.
  const etapaAtaque = input.critical ? Math.max(0, attacker.stage) : attacker.stage;
  const etapaDefensa = input.critical ? Math.min(0, defender.stage) : defender.stage;

  let ataque = Math.floor(realStat(attacker, statAtaque) * stageMultiplier(etapaAtaque));
  let defensa = Math.floor(realStat(defender, statDefensa) * stageMultiplier(etapaDefensa));
  if (attacker.item === "choice") ataque = Math.floor(ataque * 1.5);
  if (defender.item === "eviolite") defensa = Math.floor(defensa * 1.5);
  if (defender.item === "assaultVest" && !fisico) defensa = Math.floor(defensa * 1.5);
  defensa = Math.max(1, defensa);

  let base = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * move.power * ataque) / defensa) / 50) + 2;

  if (input.weather === "sun") {
    if (move.type_id === "fuego") base = Math.floor(base * 1.5);
    if (move.type_id === "agua") base = Math.floor(base * 0.5);
  } else if (input.weather === "rain") {
    if (move.type_id === "agua") base = Math.floor(base * 1.5);
    if (move.type_id === "fuego") base = Math.floor(base * 0.5);
  }
  if (input.critical) base = Math.floor(base * 1.5);

  let final = 1;
  if (input.burned && fisico) final *= 0.5;
  // Las pantallas no frenan un golpe crítico.
  if (input.screen && !input.critical) final *= 0.5;
  if (attacker.item === "lifeOrb") final *= 1.3;
  if (attacker.item === "expertBelt" && effectiveness > 1) final *= 1.2;
  if (attacker.item === "typeBoost") final *= 1.2;

  const rolls: number[] = [];
  for (let r = 85; r <= 100; r++) {
    let d = Math.floor((base * r) / 100);
    if (stab) d = Math.floor(d * 1.5);
    d = Math.floor(d * effectiveness);
    d = Math.floor(d * final);
    rolls.push(Math.max(1, d));
  }

  const min = rolls[0];
  const max = rolls[rolls.length - 1];
  const pct = (d: number) => Math.round((d / hp) * 1000) / 10;
  return {
    rolls, min, max, hp,
    minPercent: pct(min), maxPercent: pct(max),
    effectiveness, stab,
    hitsWorst: Math.ceil(hp / min),
    hitsBest: Math.ceil(hp / max),
  };
}
