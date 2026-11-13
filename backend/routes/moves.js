const express = require("express");
const { createCatalog } = require("../lib/catalog");

module.exports = (db) => {
  const router = express.Router();
  const catalog = createCatalog(db);

  // Preparada una vez: antes se compilaba en cada petición.
  const detalle = db.prepare(
    `SELECT m.*, t.name_es AS type_name_es, t.name_en AS type_name_en, t.color
       FROM moves m JOIN types t ON t.id = m.type_id WHERE m.id = ?`
  );

  router.get("/", (req, res) => {
    // El mismo SELECT que usa el modo Champions: vive en lib/catalog.js.
    res.json(catalog.moves());
  });

  router.get("/:id", (req, res) => {
    const m = detalle.get(req.params.id);
    if (!m) return res.status(404).json({ error: "Movimiento no encontrado" });
    res.json(m);
  });

  return router;
};
