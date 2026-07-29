"use strict";

/**
 * PamuDeX — Tarea 3.2
 * Tabla de efectividad de tipos: base canónica + carga desde la DB + overrides.
 *
 * Por qué existe la tabla canónica escrita a mano: el middleware de overrides
 * necesita el 18x18 completo para recalcular efectividades, y la tabla `relations`
 * del esquema puede tener nombres de columna distintos según cómo se sembrara.
 * Se intenta leer de la DB primero; si no se reconoce el formato, se usa esta.
 * Los overrides de sesión se aplican encima en cualquiera de los dos casos.
 */

const TYPE_IDS = [
  "normal", "fuego", "agua", "electrico", "planta", "hielo",
  "lucha", "veneno", "tierra", "volador", "psiquico", "bicho",
  "roca", "fantasma", "dragon", "siniestro", "acero", "hada",
];

/** Solo se listan los multiplicadores distintos de 1 (atacante -> defensor). */
const BASE_CHART = {
  normal:     { roca: 0.5, acero: 0.5, fantasma: 0 },
  fuego:      { fuego: 0.5, agua: 0.5, planta: 2, hielo: 2, bicho: 2, roca: 0.5, dragon: 0.5, acero: 2 },
  agua:       { fuego: 2, agua: 0.5, planta: 0.5, tierra: 2, roca: 2, dragon: 0.5 },
  electrico:  { agua: 2, electrico: 0.5, planta: 0.5, tierra: 0, volador: 2, dragon: 0.5 },
  planta:     { fuego: 0.5, agua: 2, planta: 0.5, veneno: 0.5, tierra: 2, volador: 0.5, bicho: 0.5, roca: 2, dragon: 0.5, acero: 0.5 },
  hielo:      { fuego: 0.5, agua: 0.5, planta: 2, hielo: 0.5, tierra: 2, volador: 2, dragon: 2, acero: 0.5 },
  lucha:      { normal: 2, hielo: 2, veneno: 0.5, volador: 0.5, psiquico: 0.5, bicho: 0.5, roca: 2, fantasma: 0, siniestro: 2, acero: 2, hada: 0.5 },
  veneno:     { planta: 2, veneno: 0.5, tierra: 0.5, roca: 0.5, fantasma: 0.5, acero: 0, hada: 2 },
  tierra:     { fuego: 2, electrico: 2, planta: 0.5, veneno: 2, volador: 0, bicho: 0.5, roca: 2, acero: 2 },
  volador:    { electrico: 0.5, planta: 2, lucha: 2, bicho: 2, roca: 0.5, acero: 0.5 },
  psiquico:   { lucha: 2, veneno: 2, psiquico: 0.5, siniestro: 0, acero: 0.5 },
  bicho:      { fuego: 0.5, planta: 2, lucha: 0.5, veneno: 0.5, volador: 0.5, psiquico: 2, fantasma: 0.5, siniestro: 2, acero: 0.5, hada: 0.5 },
  roca:       { fuego: 2, hielo: 2, lucha: 0.5, tierra: 0.5, volador: 2, bicho: 2, acero: 0.5 },
  fantasma:   { normal: 0, psiquico: 2, fantasma: 2, siniestro: 0.5 },
  dragon:     { dragon: 2, acero: 0.5, hada: 0 },
  siniestro:  { lucha: 0.5, psiquico: 2, fantasma: 2, siniestro: 0.5, hada: 0.5 },
  acero:      { fuego: 0.5, agua: 0.5, electrico: 0.5, hielo: 2, roca: 2, acero: 0.5, hada: 2 },
  hada:       { fuego: 0.5, lucha: 2, veneno: 0.5, dragon: 2, siniestro: 2, acero: 0.5 },
};

/** Convierte el formato compacto (solo != 1) en un 18x18 completo. */
function expand(compact) {
  const full = {};
  for (const atk of TYPE_IDS) {
    full[atk] = {};
    for (const def of TYPE_IDS) {
      const row = compact[atk] || {};
      full[atk][def] = row[def] === undefined ? 1 : Number(row[def]);
    }
  }
  return full;
}

/** Busca en una fila de ejemplo la columna cuyo nombre encaje con alguna pista. */
function pickColumn(sampleRow, hints) {
  const keys = Object.keys(sampleRow);
  for (const hint of hints) {
    const found = keys.find((k) => k.toLowerCase().includes(hint));
    if (found) return found;
  }
  return null;
}

/**
 * Intenta leer la tabla `relations` sin asumir nombres de columna.
 * Devuelve un objeto compacto { atacante: { defensor: mult } } o null.
 */
function loadRelationsFromDb(db) {
  try {
    const sample = db.prepare("SELECT * FROM relations LIMIT 1").get();
    if (!sample) return null;

    const attackerCol = pickColumn(sample, ["attacker", "atk", "from", "source", "origen", "atacante"]);
    const defenderCol = pickColumn(sample, ["defender", "def", "target", "to_", "destino", "defensor"]);
    const valueCol = pickColumn(sample, ["multiplier", "mult", "factor", "value", "effect", "valor"]);
    if (!attackerCol || !defenderCol || !valueCol || attackerCol === defenderCol) return null;

    const rows = db.prepare("SELECT * FROM relations").all();
    const compact = {};
    for (const row of rows) {
      const atk = String(row[attackerCol]);
      const def = String(row[defenderCol]);
      const mult = Number(row[valueCol]);
      if (!TYPE_IDS.includes(atk) || !TYPE_IDS.includes(def) || Number.isNaN(mult)) continue;
      if (!compact[atk]) compact[atk] = {};
      compact[atk][def] = mult;
    }
    return Object.keys(compact).length ? compact : null;
  } catch (err) {
    return null;
  }
}

/**
 * Tabla 18x18 final: DB (o canónica) + overrides de la sesión.
 * relationsOverride tiene la forma { fuego: { agua: 1 } }.
 */
function buildChart(db, relationsOverride) {
  const fromDb = db ? loadRelationsFromDb(db) : null;
  const chart = expand(fromDb || BASE_CHART);

  if (relationsOverride && typeof relationsOverride === "object") {
    for (const atk of Object.keys(relationsOverride)) {
      if (!chart[atk]) continue;
      const row = relationsOverride[atk];
      if (!row || typeof row !== "object") continue;
      for (const def of Object.keys(row)) {
        if (chart[atk][def] === undefined) continue;
        const mult = Number(row[def]);
        if (!Number.isNaN(mult)) chart[atk][def] = mult;
      }
    }
  }
  return chart;
}

/** Multiplicador defensivo de un Pokémon: producto de sus tipos. */
function defensiveMultiplier(chart, attackerType, defenderTypes) {
  return defenderTypes.reduce((acc, def) => {
    const row = chart[attackerType];
    const value = row && row[def] !== undefined ? row[def] : 1;
    return acc * value;
  }, 1);
}

module.exports = {
  TYPE_IDS,
  BASE_CHART,
  expand,
  loadRelationsFromDb,
  buildChart,
  defensiveMultiplier,
};
