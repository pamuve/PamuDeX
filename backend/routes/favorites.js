"use strict";

/**
 * PamuDeX — Tarea 5.3
 * Favoritos por perfil.
 *
 * Tabla (backend/db/schema.sql, creada también por db/migrate.js):
 *   favorites(id, profile_id, entity_type, entity_ref, created_at)
 *   con índice ÚNICO en (profile_id, entity_type, entity_ref)
 *
 * EL PERFIL VIAJA COMO ?profile=<id>, IGUAL QUE ?session=
 * ------------------------------------------------------
 * No hay tokens ni sesiones de servidor (eso queda fuera de alcance hasta que
 * exista un login real), así que el perfil se indica en la query. Es coherente
 * con cómo funcionan ya las sesiones de ROM Hack.
 *
 * ESTA RUTA DEVUELVE REFERENCIAS, NO NOMBRES
 * ------------------------------------------
 * A propósito: los nombres los resuelve el frontend con los listados que ya
 * tiene cacheados. Así los favoritos respetan automáticamente los overrides de
 * la sesión activa (un Pokémon renombrado en tu ROM Hack aparece con su nombre
 * nuevo), cosa que un JOIN aquí no daría: el middleware sessionOverrides solo
 * transforma types/pokemon/moves/abilities y /search.
 *
 * Convención del proyecto: el módulo exporta (db) => router y se monta en server.js.
 */

const express = require("express");

/** Tipos de entidad admitidos. Cualquier otro se rechaza. */
const ENTITY_TYPES = ["pokemon", "move", "ability", "type"];

const MAX_REF = 40;

/** Convierte un id de la query en entero positivo, o null si no es válido. */
function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Normaliza la referencia a la entidad.
 * Se guarda siempre como cadena porque los tipos usan ids de texto ('fuego') y
 * el resto enteros; unificarlo evita que '1' y 1 creen dos filas distintas.
 */
function cleanRef(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_REF);
}

module.exports = (db) => {
  const router = express.Router();

  const q = {
    list: db.prepare(
      `SELECT id, entity_type, entity_ref, created_at
         FROM favorites
        WHERE profile_id = ?
        ORDER BY datetime(created_at) DESC, id DESC`
    ),
    // El índice único hace el trabajo: si ya estaba, no se duplica ni falla.
    insert: db.prepare(
      `INSERT OR IGNORE INTO favorites (profile_id, entity_type, entity_ref, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    ),
    remove: db.prepare(
      `DELETE FROM favorites
        WHERE profile_id = ? AND entity_type = ? AND entity_ref = ?`
    ),
    profileExists: db.prepare(`SELECT 1 FROM profiles WHERE id = ?`),
  };

  /**
   * Saca el perfil de la query y comprueba que existe.
   * Devuelve el id, o null tras haber respondido ya con el error.
   */
  function profileFrom(req, res) {
    const profileId = parseId(req.query.profile);
    if (!profileId) {
      res.status(400).json({ error: "perfil_requerido" });
      return null;
    }
    if (!q.profileExists.get(profileId)) {
      res.status(404).json({ error: "perfil_no_encontrado" });
      return null;
    }
    return profileId;
  }

  /** Valida entity_type y entity_ref del cuerpo. */
  function entityFrom(body, res) {
    const entityType = body && body.entity_type;
    if (!ENTITY_TYPES.includes(entityType)) {
      res.status(400).json({ error: "tipo_invalido" });
      return null;
    }
    const entityRef = cleanRef(body && body.entity_ref);
    if (!entityRef) {
      res.status(400).json({ error: "referencia_requerida" });
      return null;
    }
    return { entityType, entityRef };
  }

  // GET /api/favorites?profile=1 -> favoritos del perfil, agrupados por tipo.
  //
  // Se devuelven las dos formas: `items` en orden cronológico inverso y `byType`
  // ya agrupado, que es como lo pinta /favoritos. Son pocos datos y ahorra que
  // cada pantalla repita el mismo agrupamiento.
  router.get("/", (req, res) => {
    const profileId = profileFrom(req, res);
    if (!profileId) return;

    const items = q.list.all(profileId);
    const byType = { pokemon: [], move: [], ability: [], type: [] };
    for (const item of items) {
      if (byType[item.entity_type]) byType[item.entity_type].push(item.entity_ref);
    }

    res.json({ profile_id: profileId, items, byType });
  });

  // POST /api/favorites?profile=1  { entity_type, entity_ref }
  //
  // Idempotente: marcar dos veces lo mismo deja una sola fila, gracias al
  // INSERT OR IGNORE contra el índice único. Responde 200 en ambos casos para
  // que el botón optimista del frontend no tenga que distinguir.
  router.post("/", (req, res) => {
    const profileId = profileFrom(req, res);
    if (!profileId) return;

    const entity = entityFrom(req.body || {}, res);
    if (!entity) return;

    const info = q.insert.run(profileId, entity.entityType, entity.entityRef);
    res.json({
      ok: true,
      favorite: true,
      creado: info.changes > 0, // false = ya estaba marcado
      entity_type: entity.entityType,
      entity_ref: entity.entityRef,
    });
  });

  // DELETE /api/favorites?profile=1  { entity_type, entity_ref }
  //
  // También idempotente: desmarcar algo que no estaba marcado no es un error.
  router.delete("/", (req, res) => {
    const profileId = profileFrom(req, res);
    if (!profileId) return;

    const entity = entityFrom(req.body || {}, res);
    if (!entity) return;

    const info = q.remove.run(profileId, entity.entityType, entity.entityRef);
    res.json({
      ok: true,
      favorite: false,
      borrado: info.changes > 0,
      entity_type: entity.entityType,
      entity_ref: entity.entityRef,
    });
  });

  return router;
};
