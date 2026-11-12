"use strict";

/**
 * PamuDeX — Tarea 3.1
 * CRUD de sesiones personalizadas (Radical Red, Elite Redux, Mi ROM Hack...).
 *
 * Tabla usada (ya existe en backend/db/schema.sql):
 *   sessions(id, profile_id, name, description, data_json, created_at)
 *
 * Todavía no hay perfiles (Fase 5) -> profile_id = NULL.
 *
 * Convención del proyecto: el módulo exporta (db) => router y se monta en server.js.
 */

const express = require("express");

const MAX_NAME = 60;
const MAX_DESCRIPTION = 300;
const SHARE_FORMAT = "pamudex-romhack";
const SHARE_VERSION = 1;

/** Recorta y limita un texto libre. Devuelve "" si no es una cadena. */
function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/**
 * Normaliza el data_json entrante (acepta objeto o cadena JSON).
 * Devuelve una cadena JSON válida de un objeto, o null si no lo es.
 */
function normalizeDataJson(value) {
  if (value === undefined || value === null) return null;
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch (err) {
      return null;
    }
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return JSON.stringify(parsed);
}

/** Convierte el :id de la URL en entero positivo, o null si no es válido. */
function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

module.exports = (db) => {
  const router = express.Router();

  const q = {
    list: db.prepare(
      `SELECT id, profile_id, name, description, created_at
         FROM sessions
        ORDER BY datetime(created_at) DESC, id DESC`
    ),
    byId: db.prepare(
      `SELECT id, profile_id, name, description, data_json, created_at
         FROM sessions
        WHERE id = ?`
    ),
    insert: db.prepare(
      `INSERT INTO sessions (profile_id, name, description, data_json, created_at)
       VALUES (NULL, ?, ?, ?, datetime('now'))`
    ),
    update: db.prepare(
      `UPDATE sessions SET name = ?, description = ?, data_json = ? WHERE id = ?`
    ),
    remove: db.prepare(`DELETE FROM sessions WHERE id = ?`),
    nameExists: db.prepare(`SELECT 1 FROM sessions WHERE name = ? LIMIT 1`),
  };

  /** Busca un nombre libre del estilo "Radical Red (copia)", "... (copia 2)". */
  function freeCopyName(baseName) {
    let candidate = `${baseName} (copia)`.slice(0, MAX_NAME);
    let n = 2;
    while (q.nameExists.get(candidate)) {
      candidate = `${baseName} (copia ${n})`.slice(0, MAX_NAME);
      n += 1;
      if (n > 999) break;
    }
    return candidate;
  }

  // GET /api/sessions -> lista ligera (sin data_json, que puede ser grande)
  router.get("/", (req, res) => {
    res.json(q.list.all());
  });

  /* --------------------------- compartir un ROM Hack ----------------------- */
  //
  // Una sesión guarda sus overrides por ID INTERNO (`pokemon: { "25": … }`), y
  // esos ids los reparte SQLite al sembrar: no hay garantía de que coincidan en
  // otra instalación. El archivo para compartir los traduce a CLAVE NATURAL —nº
  // de Pokédex para los Pokémon, nombre en inglés para movimientos y
  // habilidades— y al importarlo se resuelven contra la base de quien lo
  // recibe. Los tipos ya van por su id canónico ('fuego').
  //
  // Lo que no se pueda resolver al importar (un movimiento que la otra
  // instalación no tiene) se omite y se cuenta, no rompe la importación.
  const naturales = {
    pokemon: {
      aClave: db.prepare("SELECT dex AS k FROM pokemon WHERE id = ?"),
      aId: db.prepare("SELECT id FROM pokemon WHERE dex = ? ORDER BY id LIMIT 1"),
    },
    moves: {
      aClave: db.prepare("SELECT name_en AS k FROM moves WHERE id = ?"),
      aId: db.prepare("SELECT id FROM moves WHERE name_en = ? ORDER BY id LIMIT 1"),
    },
    abilities: {
      aClave: db.prepare("SELECT name_en AS k FROM abilities WHERE id = ?"),
      aId: db.prepare("SELECT id FROM abilities WHERE name_en = ? ORDER BY id LIMIT 1"),
    },
  };

  function traducir(data, direccion) {
    const salida = {};
    let omitidos = 0;
    for (const [clave, valor] of Object.entries(data || {})) {
      const tabla = naturales[clave];
      if (!tabla || valor === null || typeof valor !== "object" || Array.isArray(valor)) {
        salida[clave] = valor; // types, relations, theme, options: tal cual
        continue;
      }
      salida[clave] = {};
      for (const [ref, patch] of Object.entries(valor)) {
        const fila = direccion === "exportar" ? tabla.aClave.get(ref) : tabla.aId.get(ref);
        const destino = fila ? (direccion === "exportar" ? fila.k : fila.id) : null;
        if (destino === null || destino === undefined) omitidos += 1;
        else salida[clave][String(destino)] = patch;
      }
    }
    return { data: salida, omitidos };
  }

  // GET /api/sessions/:id/share — el ROM Hack en un archivo portable
  router.get("/:id/share", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "id_invalido" });
    const row = q.byId.get(id);
    if (!row) return res.status(404).json({ error: "sesion_no_encontrada" });

    let data = {};
    try {
      data = JSON.parse(row.data_json || "{}");
    } catch (err) {
      data = {};
    }
    res.json({
      format: SHARE_FORMAT,
      version: SHARE_VERSION,
      name: row.name,
      description: row.description || "",
      data: traducir(data, "exportar").data,
    });
  });

  // POST /api/sessions/import — crea una sesión NUEVA desde un archivo compartido
  router.post("/import", (req, res) => {
    const body = req.body || {};
    if (body.format !== SHARE_FORMAT) return res.status(400).json({ error: "formato_desconocido" });
    if (!Number.isInteger(body.version) || body.version > SHARE_VERSION) {
      return res.status(400).json({ error: "version_no_soportada" });
    }
    const data = body.data;
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return res.status(400).json({ error: "data_json_invalido" });
    }

    const base = cleanText(body.name, MAX_NAME) || "ROM Hack";
    // No se pisa ni se mezcla con una sesión que ya exista con ese nombre.
    let name = base;
    for (let n = 2; q.nameExists.get(name) && n < 1000; n++) {
      name = `${base.slice(0, MAX_NAME - 6)} (${n})`;
    }
    const { data: traducido, omitidos } = traducir(data, "importar");
    const info = q.insert.run(name, cleanText(body.description, MAX_DESCRIPTION), JSON.stringify(traducido));
    res.status(201).json({ ...q.byId.get(info.lastInsertRowid), skipped: omitidos });
  });

  // GET /api/sessions/:id -> sesión completa, con data_json ya parseado en "data"
  router.get("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "id_invalido" });

    const row = q.byId.get(id);
    if (!row) return res.status(404).json({ error: "sesion_no_encontrada" });

    let data = {};
    try {
      data = JSON.parse(row.data_json || "{}");
    } catch (err) {
      data = {};
    }
    res.json({ ...row, data });
  });

  // POST /api/sessions -> crea una sesión vacía
  router.post("/", (req, res) => {
    const name = cleanText(req.body && req.body.name, MAX_NAME);
    if (!name) return res.status(400).json({ error: "nombre_requerido" });

    const description = cleanText(req.body && req.body.description, MAX_DESCRIPTION);
    const dataJson = normalizeDataJson(req.body && req.body.data_json) || "{}";

    const info = q.insert.run(name, description, dataJson);
    res.status(201).json(q.byId.get(info.lastInsertRowid));
  });

  // PUT /api/sessions/:id -> renombrar / descripción / (3.2+) overrides
  router.put("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "id_invalido" });

    const current = q.byId.get(id);
    if (!current) return res.status(404).json({ error: "sesion_no_encontrada" });

    const body = req.body || {};

    let name = current.name;
    if (body.name !== undefined) {
      name = cleanText(body.name, MAX_NAME);
      if (!name) return res.status(400).json({ error: "nombre_requerido" });
    }

    let description = current.description;
    if (body.description !== undefined) {
      description = cleanText(body.description, MAX_DESCRIPTION);
    }

    // data_json queda preparado para la tarea 3.2 (overrides).
    let dataJson = current.data_json || "{}";
    if (body.data_json !== undefined || body.data !== undefined) {
      const incoming = normalizeDataJson(
        body.data_json !== undefined ? body.data_json : body.data
      );
      if (incoming === null) return res.status(400).json({ error: "data_json_invalido" });
      dataJson = incoming;
    }

    q.update.run(name, description, dataJson, id);
    res.json(q.byId.get(id));
  });

  // POST /api/sessions/:id/duplicate -> copia nombre + data_json
  router.post("/:id/duplicate", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "id_invalido" });

    const source = q.byId.get(id);
    if (!source) return res.status(404).json({ error: "sesion_no_encontrada" });

    const name = freeCopyName(source.name);
    const info = q.insert.run(name, source.description || "", source.data_json || "{}");
    res.status(201).json(q.byId.get(info.lastInsertRowid));
  });

  // DELETE /api/sessions/:id
  router.delete("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "id_invalido" });

    const info = q.remove.run(id);
    if (info.changes === 0) return res.status(404).json({ error: "sesion_no_encontrada" });

    res.json({ ok: true, id });
  });

  return router;
};
