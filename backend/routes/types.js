const express = require("express");
const router = express.Router();
const { createCatalog } = require("../lib/catalog");
const { createEffectiveness } = require("../lib/effectiveness");

module.exports = (db) => {
  const catalog = createCatalog(db);
  // Modo estándar: multiplicadores de siempre (ver routes/pokemon.js).
  const { offensiveProfile, defensiveProfileForSingleType } = createEffectiveness(db, null);

  router.get("/", (req, res) => {
    res.json(catalog.types());
  });

  router.get("/:id", (req, res) => {
    const type = catalog.typeDetail(req.params.id);
    if (!type) return res.status(404).json({ error: "Tipo no encontrado" });

    res.json({
      ...type,
      ofensivo: offensiveProfile(type.id),
      defensivo: defensiveProfileForSingleType(type.id),
    });
  });

  return router;
};
