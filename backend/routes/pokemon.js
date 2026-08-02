const express = require("express");
const router = express.Router();
const { defensiveProfile } = require("../lib/effectiveness");

module.exports = (db) => {
  router.get("/", (req, res) => {
    const rows = db
      .prepare(
        `SELECT p.id, p.dex, p.name_es, p.name_en, p.generation
         FROM pokemon p ORDER BY p.dex ASC`
      )
      .all();
    res.json(rows);
  });

  router.get("/:id", (req, res) => {
    // Se acepta tanto el id interno como el nº de Pokédex, pero el id manda:
    // sin ORDER BY, `id = ? OR dex = ?` devuelve una fila arbitraria cuando cada
    // condición casa con un Pokémon distinto (id 7 = Pikachu, dex 7 = Squirtle).
    const p = db
      .prepare("SELECT * FROM pokemon WHERE id = ? OR dex = ? ORDER BY (id = ?) DESC LIMIT 1")
      .get(req.params.id, req.params.id, req.params.id);
    if (!p) return res.status(404).json({ error: "Pokémon no encontrado" });

    const types = db
      .prepare(
        `SELECT t.id, t.name_es, t.name_en, t.color FROM pokemon_types pt
         JOIN types t ON t.id = pt.type_id WHERE pt.pokemon_id = ? ORDER BY pt.slot`
      )
      .all(p.id);

    const abilities = db
      .prepare(
        `SELECT a.name_es, a.name_en, a.effect_es, pa.is_hidden FROM pokemon_abilities pa
         JOIN abilities a ON a.id = pa.ability_id WHERE pa.pokemon_id = ?`
      )
      .all(p.id);

    const typeIds = types.map((t) => t.id);

    res.json({
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
      efectividad: defensiveProfile(typeIds),
    });
  });

  return router;
};
