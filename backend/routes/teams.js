"use strict";

/**
 * PamuDeX — Fase 9
 * Equipos guardados por perfil y por juego.
 *
 *   GET    /api/teams?profile=<id>&scope=<ámbito>   lista (sin el contenido)
 *   GET    /api/teams/:id?profile=<id>              uno, con su contenido
 *   POST   /api/teams?profile=<id>&scope=<ámbito>   { name, data }
 *   PUT    /api/teams/:id?profile=<id>              { name?, data? }
 *   DELETE /api/teams/:id?profile=<id>
 *
 * `data` es lo que el comparador guarda tal cual: `{ own: Team, rival: RivalTeam }`.
 * El backend no lo interpreta —solo comprueba que es un objeto y que no pesa una
 * barbaridad—, igual que `sessions.data_json`.
 *
 * El equipo EN USO sigue viviendo en `localStorage`: el comparador tiene que
 * funcionar sin conexión y guardar en cada cambio. Esto es la estantería donde
 * se dejan con nombre.
 */

const express = require("express");
const { createProfileScope, parseId } = require("../lib/scope");

const MAX_NAME = 60;
const MAX_DATA = 200 * 1024;
const MAX_TEAMS = 100;

function cleanName(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_NAME) : "";
}

/** Devuelve el JSON serializado, o null si no es un objeto o es demasiado grande. */
function serializar(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  const json = JSON.stringify(data);
  return json.length > MAX_DATA ? null : json;
}

module.exports = (db) => {
  const router = express.Router();
  const profileScope = createProfileScope(db);

  const q = {
    list: db.prepare(
      `SELECT id, scope, name, updated_at FROM teams
        WHERE profile_id = ? AND scope = ?
        ORDER BY datetime(updated_at) DESC, id DESC`
    ),
    byId: db.prepare(`SELECT id, scope, name, data_json, updated_at FROM teams WHERE id = ? AND profile_id = ?`),
    count: db.prepare(`SELECT COUNT(*) AS c FROM teams WHERE profile_id = ?`),
    insert: db.prepare(
      `INSERT INTO teams (profile_id, scope, name, data_json, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ),
    update: db.prepare(
      `UPDATE teams SET name = ?, data_json = ?, updated_at = datetime('now') WHERE id = ? AND profile_id = ?`
    ),
    remove: db.prepare(`DELETE FROM teams WHERE id = ? AND profile_id = ?`),
  };

  function toApi(row) {
    let data = {};
    try {
      data = JSON.parse(row.data_json || "{}");
    } catch (err) {
      data = {};
    }
    return { id: row.id, scope: row.scope, name: row.name, updated_at: row.updated_at, data };
  }

  router.get("/", (req, res) => {
    const ctx = profileScope(req, res);
    if (!ctx) return;
    res.json({ profile_id: ctx.profileId, scope: ctx.scope, items: q.list.all(ctx.profileId, ctx.scope) });
  });

  router.get("/:id", (req, res) => {
    const ctx = profileScope(req, res);
    if (!ctx) return;
    const row = q.byId.get(parseId(req.params.id), ctx.profileId);
    if (!row) return res.status(404).json({ error: "equipo_no_encontrado" });
    res.json(toApi(row));
  });

  router.post("/", (req, res) => {
    const ctx = profileScope(req, res);
    if (!ctx) return;
    const body = req.body || {};
    const name = cleanName(body.name);
    if (!name) return res.status(400).json({ error: "nombre_requerido" });
    const json = serializar(body.data);
    if (json === null) return res.status(400).json({ error: "datos_invalidos" });
    if (q.count.get(ctx.profileId).c >= MAX_TEAMS) return res.status(400).json({ error: "demasiados_equipos" });

    const info = q.insert.run(ctx.profileId, ctx.scope, name, json);
    res.status(201).json(toApi(q.byId.get(info.lastInsertRowid, ctx.profileId)));
  });

  router.put("/:id", (req, res) => {
    const ctx = profileScope(req, res);
    if (!ctx) return;
    const id = parseId(req.params.id);
    const actual = q.byId.get(id, ctx.profileId);
    if (!actual) return res.status(404).json({ error: "equipo_no_encontrado" });

    const body = req.body || {};
    let name = actual.name;
    if (body.name !== undefined) {
      name = cleanName(body.name);
      if (!name) return res.status(400).json({ error: "nombre_requerido" });
    }
    let json = actual.data_json;
    if (body.data !== undefined) {
      json = serializar(body.data);
      if (json === null) return res.status(400).json({ error: "datos_invalidos" });
    }
    q.update.run(name, json, id, ctx.profileId);
    res.json(toApi(q.byId.get(id, ctx.profileId)));
  });

  router.delete("/:id", (req, res) => {
    const ctx = profileScope(req, res);
    if (!ctx) return;
    const info = q.remove.run(parseId(req.params.id), ctx.profileId);
    if (info.changes === 0) return res.status(404).json({ error: "equipo_no_encontrado" });
    res.json({ ok: true });
  });

  return router;
};
