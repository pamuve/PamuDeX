"use strict";

/**
 * PamuDeX — Tarea 3.2 / 3.4
 * GET /api/chart[?session=<id>]
 *
 * Devuelve la tabla de efectividad 18x18 completa, con los overrides de la
 * sesión ya aplicados. La necesita `RelationsMatrix.tsx` (tarea 3.4), porque
 * reconstruirla pidiendo /api/types/:id dieciocho veces sería absurdo.
 *
 *   { types: [{ id, name_es, name_en, color }], chart: { fuego: { agua: 0.5, ... } } }
 */

const express = require("express");
const { TYPE_IDS, buildChart } = require("../lib/typechart");
const { getSessionOverrides, applyOverrides, isPlainObject } = require("../lib/overrides");

module.exports = (db) => {
  const router = express.Router();

  router.get("/", (req, res) => {
    const overrides = req.query.session ? getSessionOverrides(db, req.query.session) : {};
    const typesOverride = isPlainObject(overrides.types) ? overrides.types : {};

    let types = [];
    try {
      types = db.prepare("SELECT id, name_es, name_en, color FROM types ORDER BY rowid").all();
    } catch (err) {
      types = TYPE_IDS.map((id) => ({ id, name_es: id, name_en: id, color: "#132238" }));
    }

    types = types.map((type) => {
      const override = typesOverride[String(type.id)];
      return isPlainObject(override) ? applyOverrides(type, override) : type;
    });

    res.json({
      types,
      chart: buildChart(db, overrides.relations),
    });
  });

  return router;
};
