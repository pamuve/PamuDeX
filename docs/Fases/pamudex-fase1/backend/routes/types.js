const express = require("express");
const router = express.Router();
const { offensiveProfile, defensiveProfileForSingleType } = require("../lib/effectiveness");

module.exports = (db) => {
  router.get("/", (req, res) => {
    res.json(db.prepare("SELECT id, name_es, name_en, color FROM types").all());
  });

  router.get("/:id", (req, res) => {
    const type = db.prepare("SELECT id, name_es, name_en, color FROM types WHERE id = ?").get(req.params.id);
    if (!type) return res.status(404).json({ error: "Tipo no encontrado" });
    res.json({
      ...type,
      ofensivo: offensiveProfile(type.id),
      defensivo: defensiveProfileForSingleType(type.id),
    });
  });

  return router;
};
