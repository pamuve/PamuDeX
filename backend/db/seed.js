// Crea (o recrea) la base de datos SQLite y la puebla con los datos semilla de /backend/data
// Uso: node db/seed.js

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "pamudex.sqlite");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");
const DATA_DIR = path.join(__dirname, "..", "data");

function readJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

function seed() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  const db = new Database(DB_PATH);
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));

  const types = readJSON("types.json");
  const typeChart = readJSON("type_chart.json");
  const pokemonList = readJSON("pokemon.json");
  const moves = readJSON("moves.json");
  const abilities = readJSON("abilities.json");

  const generations = Array.from({ length: 9 }, (_, i) => i + 1).map((n) => ({
    id: n,
    name_es: `Generación ${n}`,
    name_en: `Generation ${n}`,
  }));

  const insertGen = db.prepare("INSERT INTO generations (id, name_es, name_en) VALUES (?, ?, ?)");
  generations.forEach((g) => insertGen.run(g.id, g.name_es, g.name_en));

  const insertType = db.prepare("INSERT INTO types (id, name_es, name_en, color) VALUES (?, ?, ?, ?)");
  types.forEach((t) => insertType.run(t.id, t.es, t.en, t.color));

  const insertRelation = db.prepare(
    "INSERT INTO relations (attacker_type, defender_type, multiplier, generation) VALUES (?, ?, ?, 6)"
  );
  Object.entries(typeChart).forEach(([attacker, defenders]) => {
    if (attacker.startsWith("_")) return;
    Object.entries(defenders).forEach(([defender, multiplier]) => {
      insertRelation.run(attacker, defender, multiplier);
    });
  });

  const insertAbility = db.prepare(
    "INSERT INTO abilities (name_es, name_en, generation, effect_es) VALUES (?, ?, ?, ?)"
  );
  const abilityIdByName = new Map();
  abilities.forEach((a) => {
    const info = insertAbility.run(a.name_es, a.name_en, a.generation, a.effect_es);
    abilityIdByName.set(a.name_es, info.lastInsertRowid);
  });
  // Asegura que toda habilidad referenciada por un Pokémon exista (aunque no tenga ficha propia todavía)
  function ensureAbilityId(name) {
    if (!name) return null;
    if (abilityIdByName.has(name)) return abilityIdByName.get(name);
    const info = insertAbility.run(name, name, null, null);
    abilityIdByName.set(name, info.lastInsertRowid);
    return info.lastInsertRowid;
  }

  const insertPokemon = db.prepare(`
    INSERT INTO pokemon (dex, name_es, name_en, generation, hidden_ability, hp, atk, def, spa, spd, spe, height_m, weight_kg)
    VALUES (@dex, @name_es, @name_en, @generation, @hidden_ability, @hp, @atk, @def, @spa, @spd, @spe, @height_m, @weight_kg)
  `);
  const insertPokemonType = db.prepare(
    "INSERT INTO pokemon_types (pokemon_id, type_id, slot) VALUES (?, ?, ?)"
  );
  const insertPokemonAbility = db.prepare(
    "INSERT INTO pokemon_abilities (pokemon_id, ability_id, is_hidden) VALUES (?, ?, ?)"
  );

  pokemonList.forEach((p) => {
    const info = insertPokemon.run({
      dex: p.dex,
      name_es: p.name_es,
      name_en: p.name_en,
      generation: p.generation,
      hidden_ability: p.hidden_ability,
      hp: p.stats.hp,
      atk: p.stats.atk,
      def: p.stats.def,
      spa: p.stats.spa,
      spd: p.stats.spd,
      spe: p.stats.spe,
      height_m: p.height_m,
      weight_kg: p.weight_kg,
    });
    const pokemonId = info.lastInsertRowid;
    p.types.forEach((typeId, idx) => insertPokemonType.run(pokemonId, typeId, idx + 1));
    p.abilities.forEach((name) => insertPokemonAbility.run(pokemonId, ensureAbilityId(name), 0));
    if (p.hidden_ability) insertPokemonAbility.run(pokemonId, ensureAbilityId(p.hidden_ability), 1);
  });

  const insertMove = db.prepare(`
    INSERT INTO moves (name_es, name_en, type_id, category, power, accuracy, pp, priority, makes_contact, generation, effect_es)
    VALUES (@name_es, @name_en, @type, @category, @power, @accuracy, @pp, @priority, @makes_contact, @generation, @effect_es)
  `);
  // makes_contact admite null = desconocido (PokeAPI no expone ese dato), así
  // que la ficha puede distinguir «no hace contacto» de «no lo sabemos».
  moves.forEach((m) =>
    insertMove.run({
      ...m,
      makes_contact: m.makes_contact === null || m.makes_contact === undefined ? null : m.makes_contact ? 1 : 0,
    })
  );

  console.log(`✔ Base de datos creada en ${DB_PATH}`);
  console.log(`  · ${types.length} tipos, ${pokemonList.length} Pokémon, ${moves.length} movimientos, ${abilityIdByName.size} habilidades`);
  db.close();
}

seed();
