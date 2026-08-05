"use strict";

/**
 * PamuDeX — dónde vive el archivo SQLite.
 *
 * POR QUÉ LOS DATOS NO PUEDEN ESTAR EN backend/db/
 * ------------------------------------------------
 * `backend/db/` es CÓDIGO: schema.sql, seed.js, populate.js, migrate.js. Si el
 * volumen de Docker se monta ahí (como hacía docker-compose.yml hasta la Fase
 * 5.2), pasa esto:
 *
 *   - Docker copia el contenido de la imagen al volumen SOLO si el volumen está
 *     vacío. En un despliegue nuevo funciona... y deja una copia del código
 *     dentro del volumen.
 *   - A partir de ahí el volumen ya no está vacío, así que Docker NUNCA lo
 *     vuelve a refrescar. El código de `db/` queda congelado en la versión del
 *     primer despliegue: actualizar la imagen no actualiza seed.js ni schema.sql
 *     ni populate.js, y un archivo nuevo como migrate.js jamás llega (el
 *     contenedor arranca y muere con MODULE_NOT_FOUND).
 *
 * La solución es la de siempre: el volumen se monta en un directorio que
 * contiene DATOS Y NADA MÁS. `PAMUDEX_DB_DIR` lo hace configurable; el
 * Dockerfile lo apunta a /data y docker-compose.yml monta el volumen ahí.
 *
 * En local no cambia nada: sin la variable, la base de datos sigue en
 * `backend/db/pamudex.sqlite` como siempre.
 */

const path = require("path");
const fs = require("fs");

const DEFAULT_DIR = __dirname; // backend/db, el comportamiento de siempre en local

const DB_DIR = process.env.PAMUDEX_DB_DIR
  ? path.resolve(process.env.PAMUDEX_DB_DIR)
  : DEFAULT_DIR;

const DB_PATH = path.join(DB_DIR, "pamudex.sqlite");

/** El esquema es código: siempre junto a este archivo, nunca en el volumen. */
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

/** Crea el directorio de datos si hace falta (volumen recién montado). */
function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
}

module.exports = { DB_DIR, DB_PATH, SCHEMA_PATH, ensureDbDir };
