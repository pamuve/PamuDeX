const express = require("express");
const router = express.Router();

module.exports = (db) => {
  router.get("/", (req, res) => {
    res.json(db.prepare("SELECT id, name_es, name_en FROM abilities ORDER BY name_es").all());
  });

  router.get("/:id", (req, res) => {
    const a = db.prepare("SELECT * FROM abilities WHERE id = ?").get(req.params.id);
    if (!a) return res.status(404).json({ error: "Habilidad no encontrada" });
    const pokemonConEsta = db
      .prepare(
        `SELECT p.id, p.dex, p.name_es, pa.is_hidden FROM pokemon_abilities pa
         JOIN pokemon p ON p.id = pa.pokemon_id WHERE pa.ability_id = ? ORDER BY p.dex`
      )
      .all(a.id);
    res.json({ ...a, pokemon: pokemonConEsta });
  });

  return router;
};
