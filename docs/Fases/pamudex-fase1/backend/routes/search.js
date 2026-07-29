const express = require("express");
const router = express.Router();

module.exports = (db) => {
  router.get("/", (req, res) => {
    const q = `%${(req.query.q || "").toLowerCase()}%`;
    if (q === "%%") return res.json({ pokemon: [], types: [], moves: [], abilities: [] });

    const pokemon = db
      .prepare("SELECT id, dex, name_es, name_en FROM pokemon WHERE LOWER(name_es) LIKE ? OR LOWER(name_en) LIKE ? LIMIT 8")
      .all(q, q);
    const types = db
      .prepare("SELECT id, name_es, name_en, color FROM types WHERE LOWER(name_es) LIKE ? OR LOWER(name_en) LIKE ? LIMIT 8")
      .all(q, q);
    const moves = db
      .prepare("SELECT id, name_es, name_en FROM moves WHERE LOWER(name_es) LIKE ? OR LOWER(name_en) LIKE ? LIMIT 8")
      .all(q, q);
    const abilities = db
      .prepare("SELECT id, name_es, name_en FROM abilities WHERE LOWER(name_es) LIKE ? OR LOWER(name_en) LIKE ? LIMIT 8")
      .all(q, q);

    res.json({ pokemon, types, moves, abilities });
  });

  return router;
};
