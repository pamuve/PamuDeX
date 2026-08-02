"use strict";

/**
 * PamuDeX — Tareas 4.1 a 4.4
 * Construye el dataset en FORMATO SEMILLA (el de `backend/data/*.json`) a
 * partir de la base, con los overrides de una sesión ya resueltos.
 *
 * Vive aparte porque lo usan tanto la exportación (`routes/export.js`) como la
 * importación (`routes/import.js`): el diff de la importación compara contra
 * exactamente lo que produce la exportación, y eso es lo que garantiza que
 * reimportar un export propio dé «0 cambios».
 */

const { applyOverrides, overrideFor } = require("./overrides");

const ENTITIES = ["pokemon", "moves", "abilities", "types"];
const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"];

/* ------------------------------- utilidades ------------------------------- */

/** El override guarda las habilidades como objetos; el formato seed, como nombres. */
function abilityNames(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => (typeof item === "string" ? item : item && typeof item === "object" ? item.name_es : ""))
    .filter(Boolean);
}


function buildTypes(db, overrides) {
  return db
    .prepare("SELECT id, name_es, name_en, color FROM types ORDER BY id")
    .all()
    .map((row) => {
      const merged = applyOverrides(row, overrideFor(overrides, "types", row.id) || {});
      return { id: merged.id, es: merged.name_es, en: merged.name_en, color: merged.color };
    });
}

/**
 * type_chart sólo lista lo que NO vale 1, igual que el JSON semilla: seed.js
 * asume 1 para todo lo que no aparezca. Si un override devuelve una relación a
 * 1, aquí desaparece, que es exactamente lo correcto.
 */
function buildTypeChart(db, overrides) {
  const chart = {};
  for (const r of db.prepare("SELECT attacker_type, defender_type, multiplier FROM relations").all()) {
    if (!chart[r.attacker_type]) chart[r.attacker_type] = {};
    chart[r.attacker_type][r.defender_type] = r.multiplier;
  }

  const relations = overrides && overrides.relations;
  if (relations && typeof relations === "object") {
    for (const atk of Object.keys(relations)) {
      const row = relations[atk];
      if (!row || typeof row !== "object") continue;
      if (!chart[atk]) chart[atk] = {};
      for (const def of Object.keys(row)) {
        const mult = Number(row[def]);
        if (!Number.isNaN(mult)) chart[atk][def] = mult;
      }
    }
  }

  const out = {
    _comment:
      "Multiplicador de daño cuando el ATACANTE (clave externa) golpea al DEFENSOR (clave interna). Todo lo no listado vale 1 (normal).",
  };
  for (const atk of Object.keys(chart).sort()) {
    const row = {};
    for (const def of Object.keys(chart[atk]).sort()) {
      if (chart[atk][def] !== 1) row[def] = chart[atk][def];
    }
    if (Object.keys(row).length) out[atk] = row;
  }
  return out;
}

function buildPokemon(db, overrides) {
  const rows = db.prepare("SELECT * FROM pokemon ORDER BY dex").all();
  const typesOf = db.prepare(
    "SELECT type_id FROM pokemon_types WHERE pokemon_id = ? ORDER BY slot"
  );
  const abilitiesOf = db.prepare(
    // ORDER BY obligatorio: pokemon_abilities no guarda ningún orden y sin él
    // SQLite devuelve las filas según los ability_id, que cambian de una base a
    // otra. Eso permutaba el array de habilidades y hacía que reimportar un
    // .sqlite exportado detectase cambios falsos.
    `SELECT a.name_es, a.name_en, a.effect_es, pa.is_hidden
     FROM pokemon_abilities pa JOIN abilities a ON a.id = pa.ability_id
     WHERE pa.pokemon_id = ? ORDER BY pa.is_hidden, a.name_es`
  );

  return rows.map((p) => {
    const abilities = abilitiesOf.all(p.id);
    // Se arma primero la forma de la API para que los overrides (que se
    // guardaron contra esa forma) encajen sin traducción, y se convierte a
    // formato seed al final.
    const base = {
      dex: p.dex,
      name_es: p.name_es,
      name_en: p.name_en,
      generation: p.generation,
      types: typesOf.all(p.id).map((t) => t.type_id),
      abilities: abilities.filter((a) => !a.is_hidden),
      hidden_ability: abilities.find((a) => a.is_hidden) || null,
      stats: STAT_KEYS.reduce((acc, k) => ({ ...acc, [k]: p[k] }), {}),
      height_m: p.height_m,
      weight_kg: p.weight_kg,
    };
    const merged = applyOverrides(base, overrideFor(overrides, "pokemon", p.id) || {});

    return {
      dex: merged.dex,
      name_es: merged.name_es,
      name_en: merged.name_en,
      generation: merged.generation,
      types: Array.isArray(merged.types)
        ? merged.types.map((t) => (typeof t === "string" ? t : t && t.id)).filter(Boolean)
        : [],
      abilities: abilityNames(merged.abilities),
      hidden_ability: abilityNames(merged.hidden_ability)[0] || null,
      stats: STAT_KEYS.reduce((acc, k) => ({ ...acc, [k]: merged.stats ? merged.stats[k] : null }), {}),
      height_m: merged.height_m,
      weight_kg: merged.weight_kg,
    };
  });
}

function buildMoves(db, overrides) {
  return db
    .prepare("SELECT * FROM moves ORDER BY name_es")
    .all()
    .map((m) => {
      const merged = applyOverrides(m, overrideFor(overrides, "moves", m.id) || {});
      return {
        name_es: merged.name_es,
        name_en: merged.name_en,
        type: merged.type_id,
        category: merged.category,
        power: merged.power,
        accuracy: merged.accuracy,
        pp: merged.pp,
        priority: merged.priority,
        // null = desconocido, distinto de false. Se conserva tal cual.
        makes_contact: merged.makes_contact === null ? null : Boolean(merged.makes_contact),
        generation: merged.generation,
        effect_es: merged.effect_es,
      };
    });
}

function buildAbilities(db, overrides) {
  return db
    .prepare("SELECT * FROM abilities ORDER BY name_es")
    .all()
    .map((a) => {
      const merged = applyOverrides(a, overrideFor(overrides, "abilities", a.id) || {});
      return {
        name_es: merged.name_es,
        name_en: merged.name_en,
        generation: merged.generation,
        effect_es: merged.effect_es,
      };
    });
}


/** Dataset completo, listo para exportar o para comparar contra una importación. */
function buildDataset(db, overrides) {
  return {
    types: buildTypes(db, overrides),
    type_chart: buildTypeChart(db, overrides),
    pokemon: buildPokemon(db, overrides),
    moves: buildMoves(db, overrides),
    abilities: buildAbilities(db, overrides),
  };
}

module.exports = {
  ENTITIES, STAT_KEYS, abilityNames,
  buildTypes, buildTypeChart, buildPokemon, buildMoves, buildAbilities, buildDataset,
};
