"use strict";

const express = require("express");

const MAX_Q = 60;
const LIMITE = 8;

/**
 * `LIKE` trata `%` y `_` como comodines. Sin escaparlos, buscar «%» devolvía el
 * catálogo entero y «_» cualquier nombre. Se escapan con `\` y se declara con
 * `ESCAPE` en cada consulta.
 */
const escaparLike = (texto) => texto.replace(/[\\%_]/g, "\\$&");

module.exports = (db) => {
  const router = express.Router();

  // Las sentencias se preparan UNA vez. Antes se compilaban las cuatro en cada
  // pulsación del buscador.
  const donde = "LOWER(name_es) LIKE ? ESCAPE '\\' OR LOWER(name_en) LIKE ? ESCAPE '\\'";
  const q = {
    pokemon: db.prepare(`SELECT id, dex, name_es, name_en FROM pokemon WHERE ${donde} LIMIT ${LIMITE}`),
    types: db.prepare(`SELECT id, name_es, name_en, color FROM types WHERE ${donde} LIMIT ${LIMITE}`),
    moves: db.prepare(`SELECT id, name_es, name_en FROM moves WHERE ${donde} LIMIT ${LIMITE}`),
    abilities: db.prepare(`SELECT id, name_es, name_en FROM abilities WHERE ${donde} LIMIT ${LIMITE}`),
  };

  router.get("/", (req, res) => {
    // `?q[]=a` llega como array y `?q[x]=a` como objeto: sin esta comprobación
    // el `.toLowerCase()` lanzaba y la ruta respondía 500.
    const texto = typeof req.query.q === "string" ? req.query.q.trim().slice(0, MAX_Q).toLowerCase() : "";
    if (!texto) return res.json({ pokemon: [], types: [], moves: [], abilities: [] });

    const patron = `%${escaparLike(texto)}%`;
    res.json({
      pokemon: q.pokemon.all(patron, patron),
      types: q.types.all(patron, patron),
      moves: q.moves.all(patron, patron),
      abilities: q.abilities.all(patron, patron),
    });
  });

  return router;
};
