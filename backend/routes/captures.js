"use strict";

/**
 * PamuDeX — Fase 9
 * Seguimiento de partida: qué Pokémon ha capturado un perfil en cada juego.
 *
 *   GET    /api/captures?profile=<id>&scope=<ámbito>   { pokemon: [ids] }
 *   POST   /api/captures?profile=<id>&scope=<ámbito>   { pokemon_id }
 *   DELETE /api/captures?profile=<id>&scope=<ámbito>   { pokemon_id }
 *
 * Mismo patrón que `routes/favorites.js`: perfil en la query, alta idempotente
 * y baja que no falla si no estaba. El ámbito está explicado en `lib/scope.js`.
 */

const express = require("express");
const { createProfileScope, parseId } = require("../lib/scope");

module.exports = (db) => {
  const router = express.Router();
  const profileScope = createProfileScope(db);

  const q = {
    list: db.prepare(
      `SELECT pokemon_id FROM captures WHERE profile_id = ? AND scope = ? ORDER BY pokemon_id`
    ),
    insert: db.prepare(
      `INSERT OR IGNORE INTO captures (profile_id, scope, pokemon_id, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    ),
    remove: db.prepare(`DELETE FROM captures WHERE profile_id = ? AND scope = ? AND pokemon_id = ?`),
  };

  router.get("/", (req, res) => {
    const ctx = profileScope(req, res);
    if (!ctx) return;
    res.json({
      profile_id: ctx.profileId,
      scope: ctx.scope,
      pokemon: q.list.all(ctx.profileId, ctx.scope).map((r) => r.pokemon_id),
    });
  });

  function cambiar(capturado) {
    return (req, res) => {
      const ctx = profileScope(req, res);
      if (!ctx) return;
      const pokemonId = parseId(req.body && req.body.pokemon_id);
      if (!pokemonId) return res.status(400).json({ error: "pokemon_requerido" });
      const sentencia = capturado ? q.insert : q.remove;
      const info = sentencia.run(ctx.profileId, ctx.scope, pokemonId);
      res.json({ ok: true, pokemon_id: pokemonId, captured: capturado, cambiado: info.changes > 0 });
    };
  }

  router.post("/", cambiar(true));
  router.delete("/", cambiar(false));

  return router;
};
