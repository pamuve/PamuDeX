"use strict";

/**
 * PamuDeX — piezas de la capa HTTP que comparten `server.js` y las pruebas.
 */

const express = require("express");

/**
 * Tope del cuerpo JSON.
 *
 * El de Express por defecto son 100 KB, y `PUT /api/sessions/:id` recibe el
 * documento de overrides ENTERO en cada guardado. Un ROM Hack que toca casi todo
 * el catálogo (o una sesión rellenada con el importador, que sí admite 50 MB)
 * pasa de ahí con facilidad: unas 150 KB con solo cambiar stats y tipos de los
 * 1025 Pokémon. A partir de ese punto cualquier edición respondía 413 y la
 * sesión dejaba de poder guardarse.
 */
const JSON_LIMIT = "10mb";

const jsonBody = () => express.json({ limit: JSON_LIMIT });

/**
 * Manejador de errores de la API. Va el ÚLTIMO, después de todas las rutas.
 *
 * Sin él, Express responde a un cuerpo mal formado o demasiado grande con una
 * página HTML (y con la traza completa si NODE_ENV no es `production`). El
 * frontend hace `res.json()` sobre toda respuesta de la API, así que eso acababa
 * como un error de análisis sin relación aparente con la causa.
 */
// eslint-disable-next-line no-unused-vars -- Express distingue el manejador de errores por sus 4 argumentos
function apiErrors(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "cuerpo_demasiado_grande" });
  }
  if (err && (err.type === "entity.parse.failed" || err instanceof SyntaxError)) {
    return res.status(400).json({ error: "json_invalido" });
  }
  const status = err && Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(`✗ ${req.method} ${req.originalUrl}: ${err && err.stack ? err.stack : err}`);
  res.status(status).json({ error: status === 500 ? "error_interno" : "peticion_invalida" });
}

module.exports = { JSON_LIMIT, jsonBody, apiErrors };
