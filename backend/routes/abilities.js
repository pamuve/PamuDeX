const express = require("express");
const { createCatalog } = require("../lib/catalog");

module.exports = (db) => {
  const router = express.Router();
  const catalog = createCatalog(db);

  // Preparadas una vez: antes se compilaban en cada petición.
  const q = {
    detalle: db.prepare("SELECT * FROM abilities WHERE id = ?"),
    pokemon: db.prepare(
      `SELECT p.id, p.dex, p.name_es, p.name_en, pa.is_hidden FROM pokemon_abilities pa
         JOIN pokemon p ON p.id = pa.pokemon_id WHERE pa.ability_id = ? ORDER BY p.dex`
    ),
  };

  router.get("/", (req, res) => {
    res.json(catalog.abilities());
  });

  router.get("/:id", (req, res) => {
    const a = q.detalle.get(req.params.id);
    if (!a) return res.status(404).json({ error: "Habilidad no encontrada" });
    res.json({ ...a, pokemon: q.pokemon.all(a.id) });
  });

  return router;
};
