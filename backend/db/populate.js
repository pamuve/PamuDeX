"use strict";

/**
 * PamuDeX — Tarea 4.2
 * Vuelca un dataset en formato semilla dentro de una base ya creada con
 * `schema.sql`.
 *
 * Se extrajo de `seed.js` para que la siembra y la exportación a SQLite
 * (`routes/export.js`) compartan exactamente el mismo código. Si estuviese
 * duplicado, cualquier cambio de esquema dejaría una de las dos atrás sin
 * avisar. Efecto secundario útil: el `.sqlite` exportado es, por construcción,
 * idéntico a sembrar el JSON que devuelve `/api/export/json`.
 *
 * El dataset es el mismo que viven en `backend/data/*.json`:
 *   types      [{ id, es, en, color }]
 *   typeChart  { atacante: { defensor: multiplicador } }   (claves con "_" se ignoran)
 *   pokemon    [{ dex, name_es, name_en, generation, types[], abilities[],
 *                 hidden_ability, stats{}, height_m, weight_kg }]
 *   moves      [{ name_es, name_en, type, category, power, accuracy, pp,
 *                 priority, makes_contact, generation, effect_es }]
 *   abilities  [{ name_es, name_en, generation, effect_es }]
 *   items      [{ name_es, name_en, category, effect_es }]   (opcional)
 *
 * `items` es OPCIONAL a propósito (Tarea 6.0): `lib/dataset.js`, que es quien
 * construye el dataset para exportar, todavía no los conoce. Si se exigiera,
 * `/api/export/sqlite` reventaría. Un dataset sin objetos produce una base sin
 * objetos, y ya está.
 */

const GENERATIONS = 9;

/**
 * Todo el volcado va dentro de UNA transacción. Sin ella, SQLite confirma cada
 * INSERT por separado: son unas 6.000 escrituras a disco y el dataset completo
 * tarda ~7,5 s. Eso da igual en la siembra por línea de comandos, pero
 * `/api/export/sqlite` construye una base por petición y el trabajo es
 * síncrono, así que bloquearía el bucle de eventos entero ese tiempo — con
 * varias descargas seguidas el servidor deja de responder.
 */
function populate(db, dataset) {
  return db.transaction(() => volcar(db, dataset))();
}

function volcar(db, { types, typeChart, pokemon, moves, abilities, items = [] }) {
  const insertGen = db.prepare("INSERT INTO generations (id, name_es, name_en) VALUES (?, ?, ?)");
  for (let n = 1; n <= GENERATIONS; n++) {
    insertGen.run(n, `Generación ${n}`, `Generation ${n}`);
  }

  const insertType = db.prepare("INSERT INTO types (id, name_es, name_en, color) VALUES (?, ?, ?, ?)");
  types.forEach((t) => insertType.run(t.id, t.es, t.en, t.color));

  const insertRelation = db.prepare(
    "INSERT INTO relations (attacker_type, defender_type, multiplier, generation) VALUES (?, ?, ?, 6)"
  );
  Object.entries(typeChart).forEach(([attacker, defenders]) => {
    if (attacker.startsWith("_")) return; // `_comment` del JSON semilla
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

  // Red de seguridad: si un Pokémon nombra una habilidad sin ficha propia, se
  // crea vacía en vez de romper la clave foránea.
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

  pokemon.forEach((p) => {
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
      makes_contact:
        m.makes_contact === null || m.makes_contact === undefined ? null : m.makes_contact ? 1 : 0,
    })
  );

  // Objetos (Tarea 6.0). El volcado vive aquí y no en seed.js para que lo
  // comparta la exportación a SQLite el día que `lib/dataset.js` los incluya.
  insertItems(db, items);

  return {
    types: types.length,
    pokemon: pokemon.length,
    moves: moves.length,
    abilities: abilityIdByName.size,
    items: items.length,
  };
}

/**
 * Inserta los objetos. Se expone aparte porque `db/migrate.js` la reutiliza:
 * una instalación que ya existe no puede resembrar (perdería perfiles,
 * sesiones, favoritos, historial y ajustes), así que los objetos entran por
 * migración cuando la tabla está vacía.
 */
function insertItems(db, items) {
  if (!items || !items.length) return 0;
  const insert = db.prepare(
    "INSERT INTO items (name_es, name_en, category, effect_es) VALUES (?, ?, ?, ?)"
  );
  for (const it of items) {
    insert.run(it.name_es, it.name_en ?? null, it.category ?? null, it.effect_es ?? null);
  }
  return items.length;
}

module.exports = { populate, insertItems };
