"use strict";

/**
 * PamuDeX — carga de los datos «extra» del dataset (Fase 9): movimientos por
 * Pokémon, evoluciones, formas y efectos en inglés.
 *
 * Los JSON los genera `tools/fetch-extras.js` y referencian por CLAVE NATURAL
 * (nº de Pokédex, `name_en`). Aquí se resuelven contra la base que haya delante,
 * igual que `insertEntityChanges` hace con el historial de generaciones.
 *
 * QUIÉN LLAMA A ESTO
 * ------------------
 *  - `db/seed.js`, al crear una base desde cero.
 *  - `db/migrate.js`, en una instalación que ya existía: cada tabla se rellena
 *    solo si está vacía, así que no pisa nada.
 *  - `routes/import.js`, tras una importación global: `populate` no conoce
 *    `effect_en` y la columna se queda a NULL en todo lo reinsertado.
 *
 * Una referencia que no resuelve se salta sin romper nada: es lo que pasa con un
 * dataset importado que ha quitado o renombrado un movimiento.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const METODOS = { l: "level", m: "machine", e: "egg", t: "tutor" };

function leer(archivo) {
  const ruta = path.join(DATA_DIR, archivo);
  if (!fs.existsSync(ruta)) return null;
  return JSON.parse(fs.readFileSync(ruta, "utf-8"));
}

const mapa = (db, sql) => new Map(db.prepare(sql).all().map((r) => [String(r.k), r.id]));
const pokemonPorDex = (db) => mapa(db, "SELECT dex AS k, id FROM pokemon");

/** Movimientos que aprende cada Pokémon. Devuelve cuántas filas ha insertado. */
function seedLearnsets(db) {
  const datos = leer("learnsets.json");
  if (!datos) return 0;

  const pokemon = pokemonPorDex(db);
  const movimientos = mapa(db, "SELECT name_en AS k, id FROM moves");
  const idDe = datos.moves.map((nombre) => movimientos.get(nombre));
  const insert = db.prepare(
    "INSERT OR IGNORE INTO pokemon_moves (pokemon_id, move_id, method, level) VALUES (?, ?, ?, ?)"
  );

  let n = 0;
  // Son unas 100.000 filas: sin transacción el arranque se iría a minutos.
  db.transaction(() => {
    for (const [dex, set] of Object.entries(datos.sets)) {
      const pokemonId = pokemon.get(dex);
      if (pokemonId === undefined) continue;
      for (const [i, nivel] of set.l || []) {
        if (idDe[i] !== undefined) n += insert.run(pokemonId, idDe[i], METODOS.l, nivel).changes;
      }
      for (const clave of ["m", "e", "t"]) {
        for (const i of set[clave] || []) {
          if (idDe[i] !== undefined) n += insert.run(pokemonId, idDe[i], METODOS[clave], null).changes;
        }
      }
    }
  })();
  return n;
}

function seedEvolutions(db) {
  const datos = leer("evolutions.json");
  if (!datos) return 0;
  const pokemon = pokemonPorDex(db);
  const insert = db.prepare(
    "INSERT OR IGNORE INTO evolutions (from_pokemon_id, to_pokemon_id, method_es, method_en) VALUES (?, ?, ?, ?)"
  );
  let n = 0;
  db.transaction(() => {
    for (const e of datos) {
      const desde = pokemon.get(String(e.from));
      const hasta = pokemon.get(String(e.to));
      if (desde === undefined || hasta === undefined) continue;
      n += insert.run(desde, hasta, e.method_es || null, e.method_en || null).changes;
    }
  })();
  return n;
}

function seedForms(db) {
  const datos = leer("forms.json");
  if (!datos) return 0;
  const pokemon = pokemonPorDex(db);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO pokemon_forms
       (pokemon_id, form_key, sprite_id, kind, name_es, name_en, types_json,
        hp, atk, def, spa, spd, spe, height_m, weight_kg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  let n = 0;
  db.transaction(() => {
    for (const f of datos) {
      const pokemonId = pokemon.get(String(f.dex));
      if (pokemonId === undefined) continue;
      const s = f.stats || {};
      n += insert.run(
        pokemonId, f.key, f.sprite ?? null, f.kind, f.name_es, f.name_en, JSON.stringify(f.types || []),
        s.hp ?? null, s.atk ?? null, s.def ?? null, s.spa ?? null, s.spd ?? null, s.spe ?? null,
        f.height_m ?? null, f.weight_kg ?? null
      ).changes;
    }
  })();
  return n;
}

/**
 * Rellena `effect_en` SOLO donde está a NULL: no pisa un texto que alguien haya
 * escrito, y se puede volver a llamar tras cada importación global.
 */
function fillEffectsEn(db) {
  const datos = leer("effects_en.json");
  if (!datos) return 0;
  let n = 0;
  db.transaction(() => {
    for (const tabla of ["moves", "abilities", "items"]) {
      const textos = datos[tabla] || {};
      const update = db.prepare(
        `UPDATE ${tabla} SET effect_en = ? WHERE name_en = ? AND effect_en IS NULL`
      );
      for (const [nombre, texto] of Object.entries(textos)) n += update.run(texto, nombre).changes;
    }
  })();
  return n;
}

/** ¿Tiene esta tabla algún `effect_en` ya puesto? */
function hasAnyEffectEn(db) {
  const columnas = db.prepare("PRAGMA table_info(moves)").all();
  if (!columnas.some((c) => c.name === "effect_en")) return false;
  return db.prepare("SELECT COUNT(*) AS c FROM moves WHERE effect_en IS NOT NULL").get().c > 0;
}

module.exports = { seedLearnsets, seedEvolutions, seedForms, fillEffectsEn, hasAnyEffectEn };
