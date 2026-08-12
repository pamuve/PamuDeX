"use strict";

/**
 * PamuDeX — lecturas del catálogo global.
 * Extraído de las rutas en la Tarea 6.2.
 *
 * POR QUÉ EXISTE ESTE MÓDULO
 * --------------------------
 * Los listados y las fichas se leían con SQL escrito dentro de cada ruta. En
 * cuanto el modo Champions necesitó los mismos datos (`/api/champions/:id/...`)
 * aparecieron dos copias del mismo SELECT, y la 6.1 ya dejó anotado el riesgo:
 * si cambia la forma de un listado hay que acordarse de cambiarla en los dos
 * sitios. Aquí está una sola vez, y `routes/pokemon.js`, `routes/types.js`,
 * `routes/items.js`, `lib/championsFilter.js` y `routes/champions.js` la usan.
 *
 * LO QUE NO HACE: la efectividad. Eso es de `lib/effectiveness.js`, que desde la
 * 6.2 es una factoría porque el modo Champions puede redefinir los valores. Las
 * fichas de aquí salen SIN `efectividad`; la añade quien las pide, con el motor
 * que le corresponda.
 *
 * Tampoco sabe nada de sesiones: devuelve el dato GLOBAL. Los overrides de la
 * Fase 3 los aplica el middleware interceptando `res.json`, después.
 */

function createCatalog(db) {
  const q = {
    /* --------------------------- listados --------------------------- */
    pokemonList: db.prepare(
      `SELECT p.id, p.dex, p.name_es, p.name_en, p.generation
         FROM pokemon p ORDER BY p.dex ASC`
    ),
    movesList: db.prepare(
      `SELECT m.id, m.name_es, m.name_en, m.type_id, t.color, m.category, m.power, m.accuracy, m.pp
         FROM moves m JOIN types t ON t.id = m.type_id ORDER BY m.name_es`
    ),
    abilitiesList: db.prepare(`SELECT id, name_es, name_en FROM abilities ORDER BY name_es`),
    itemsList: db.prepare(`SELECT id, name_es, name_en, category FROM items ORDER BY name_es`),
    typesList: db.prepare(`SELECT id, name_es, name_en, color FROM types`),

    /* ---------------------------- fichas ---------------------------- */
    // Se acepta tanto el id interno como el nº de Pokédex, pero el id manda:
    // sin ORDER BY, `id = ? OR dex = ?` devuelve una fila arbitraria cuando cada
    // condición casa con un Pokémon distinto (id 7 = Pikachu, dex 7 = Squirtle).
    pokemon: db.prepare(
      "SELECT * FROM pokemon WHERE id = ? OR dex = ? ORDER BY (id = ?) DESC LIMIT 1"
    ),
    pokemonTypes: db.prepare(
      `SELECT t.id, t.name_es, t.name_en, t.color FROM pokemon_types pt
         JOIN types t ON t.id = pt.type_id WHERE pt.pokemon_id = ? ORDER BY pt.slot`
    ),
    // Orden estable: sin ORDER BY, las habilidades salían en un orden que
    // depende de los ability_id y variaba entre bases.
    pokemonAbilities: db.prepare(
      `SELECT a.name_es, a.name_en, a.effect_es, pa.is_hidden FROM pokemon_abilities pa
         JOIN abilities a ON a.id = pa.ability_id WHERE pa.pokemon_id = ?
         ORDER BY pa.is_hidden, a.name_es`
    ),
    type: db.prepare("SELECT id, name_es, name_en, color FROM types WHERE id = ?"),
  };

  /**
   * Ficha de Pokémon SIN `efectividad` (la añade quien la pide).
   * Devuelve null si no existe.
   */
  function pokemonDetail(idOrDex) {
    const p = q.pokemon.get(idOrDex, idOrDex, idOrDex);
    if (!p) return null;

    const types = q.pokemonTypes.all(p.id);
    const abilities = q.pokemonAbilities.all(p.id);

    return {
      id: p.id,
      dex: p.dex,
      name_es: p.name_es,
      name_en: p.name_en,
      generation: p.generation,
      types,
      abilities: abilities.filter((a) => !a.is_hidden),
      hidden_ability: abilities.find((a) => a.is_hidden) || null,
      stats: { hp: p.hp, atk: p.atk, def: p.def, spa: p.spa, spd: p.spd, spe: p.spe },
      height_m: p.height_m,
      weight_kg: p.weight_kg,
    };
  }

  return {
    // listados
    pokemon: () => q.pokemonList.all(),
    moves: () => q.movesList.all(),
    abilities: () => q.abilitiesList.all(),
    items: () => q.itemsList.all(),
    types: () => q.typesList.all(),
    // fichas
    pokemonDetail,
    typeDetail: (id) => q.type.get(id) || null,
  };
}

module.exports = { createCatalog };
