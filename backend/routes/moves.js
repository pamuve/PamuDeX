const express = require("express");
const router = express.Router();

module.exports = (db) => {
  router.get("/", (req, res) => {
    res.json(
      db
        .prepare(
          `SELECT m.id, m.name_es, m.name_en, m.type_id, t.color, m.category, m.power, m.accuracy, m.pp
           FROM moves m JOIN types t ON t.id = m.type_id ORDER BY m.name_es`
        )
        .all()
    );
  });

  router.get("/:id", (req, res) => {
    const m = db
      .prepare(
        `SELECT m.*, t.name_es AS type_name_es, t.name_en AS type_name_en, t.color
         FROM moves m JOIN types t ON t.id = m.type_id WHERE m.id = ?`
      )
      .get(req.params.id);
    if (!m) return res.status(404).json({ error: "Movimiento no encontrado" });
    res.json(m);
  });

  return router;
};