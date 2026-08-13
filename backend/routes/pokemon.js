const express = require("express");
const router = express.Router();
const { createCatalog } = require("../lib/catalog");
const { createEffectiveness } = require("../lib/effectiveness");

module.exports = (db) => {
  const catalog = createCatalog(db);
  // Sin multiplicadores propios: el modo estándar usa los de siempre
  // (x4/x2/x1/x0.5/x0.25/x0). Los redefine solo el modo Champions (Tarea 6.2).
  const { defensiveProfile } = createEffectiveness(db, null);

  router.get("/", (req, res) => {
    res.json(catalog.pokemon());
  });

  router.get("/:id", (req, res) => {
    const pokemon = catalog.pokemonDetail(req.params.id);
    if (!pokemon) return res.status(404).json({ error: "Pokémon no encontrado" });

    res.json({
      ...pokemon,
      efectividad: defensiveProfile(pokemon.types.map((t) => t.id)),
    });
  });

  return router;
};
