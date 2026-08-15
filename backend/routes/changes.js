"use strict";

/**
 * PamuDeX — Tarea 7.3
 * Cambios históricos de una entidad, ordenados por generación.
 *
 *   GET /api/changes/:entityType/:entityRef
 *
 * POR QUÉ NO ESTÁ EN `/api/history`, QUE ES LO QUE PEDÍA EL ENCARGO
 * -----------------------------------------------------------------
 * `/api/history` ya es el **historial de consultas por perfil** desde la Tarea
 * 5.4 (`routes/history.js`): qué fichas ha visitado el usuario y cuándo. Son dos
 * cosas distintas y montar las dos en el mismo prefijo haría que
 * `/api/history/pokemon/25` fuese ambiguo. El prefijo aquí es `/api/changes`.
 *
 * QUIÉN LA USA
 * ------------
 * Hoy, NADIE de la interfaz, y es a propósito: `ChangeHistory.tsx` pinta la
 * línea temporal con el `generational_changes` que la ficha ya trae embebido
 * (Tarea 7.2), así que abrir el desplegable no cuesta ni una petición y funciona
 * sin conexión. Esta ruta existe para consultar el historial SIN cargar una
 * ficha entera: es lo que se usa para comprobar una entrada recién añadida a
 * `backend/data/entity_changes.json` (ver el README).
 *
 * `entityType` es el singular de la tabla: 'pokemon' | 'move' | 'ability' | 'type'.
 */

const express = require("express");
const router = express.Router();
const { createGenerations, ENTITY_BY_PATH } = require("../lib/generations");

/** Se aceptan también los plurales de las URLs, que es el error fácil de cometer. */
const TIPOS_VALIDOS = new Set(Object.values(ENTITY_BY_PATH));

module.exports = (db) => {
  const generations = createGenerations(db);

  router.get("/:entityType/:entityRef", (req, res) => {
    const entityType = ENTITY_BY_PATH[req.params.entityType] || req.params.entityType;
    if (!TIPOS_VALIDOS.has(entityType)) {
      return res.status(400).json({ error: "tipo_de_entidad_invalido" });
    }

    const entityRef = req.params.entityRef;
    res.json({
      entity_type: entityType,
      entity_ref: entityRef,
      has_generational_differences: generations.hasGenerationalDifferences(entityType, entityRef),
      changes: generations.changesFor(entityType, entityRef),
    });
  });

  return router;
};
