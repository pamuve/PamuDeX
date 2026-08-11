"use strict";

/**
 * PamuDeX — Tarea 5.4
 * Historial de consultas por perfil.
 *
 * Tabla (backend/db/schema.sql):
 *   history(id, profile_id, entity_type, entity_ref, viewed_at)
 *
 * EL PERFIL VIAJA COMO ?profile=<id>, IGUAL QUE EN /api/favorites
 * ---------------------------------------------------------------
 * No hay tokens ni sesiones de servidor (eso queda fuera de alcance hasta que
 * exista un login real), así que el perfil se indica en la query.
 *
 * LA DEDUPLICACIÓN LA HACE ESTA RUTA, NO LA BASE DE DATOS
 * -------------------------------------------------------
 * `history` NO lleva índice único, a diferencia de `favorites`, y no debe
 * llevarlo: el historial es una bitácora y la misma ficha tiene que poder
 * aparecer varias veces en momentos distintos. Lo que no queremos son ráfagas
 * de duplicados por volver atrás o recargar, así que antes de insertar se mira
 * si esa entidad ya se registró para ese perfil en los últimos DEDUPE_MINUTES.
 *
 * ESTE HISTORIAL TIENE TECHO
 * --------------------------
 * A diferencia de los favoritos, aquí escribe la app sola cada vez que se abre
 * una ficha: sin poda, la tabla crecería sin fin en una instalación doméstica
 * que nadie mantiene. Tras cada inserción se conservan las MAX_ROWS visitas más
 * recientes del perfil y se descarta el resto.
 *
 * ESTA RUTA DEVUELVE REFERENCIAS, NO NOMBRES
 * ------------------------------------------
 * Igual que /api/favorites: los nombres los resuelve el frontend con los
 * listados que ya tiene cacheados, y así el historial respeta los overrides de
 * la sesión de ROM Hack activa sin lógica extra (el middleware
 * sessionOverrides no toca /history).
 *
 * Convención del proyecto: el módulo exporta (db) => router y se monta en server.js.
 */

const express = require("express");

/** Tipos de entidad admitidos. Cualquier otro se rechaza. */
const ENTITY_TYPES = ["pokemon", "move", "ability", "type"];

const MAX_REF = 40;

/** Ventana de deduplicación: la misma ficha no se registra dos veces seguidas. */
const DEDUPE_MINUTES = 5;

/** Cuántas visitas se conservan por perfil. Las más antiguas se descartan. */
const MAX_ROWS = 300;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Convierte un id de la query en entero positivo, o null si no es válido. */
function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Normaliza la referencia a la entidad.
 * Se guarda siempre como cadena porque los tipos usan ids de texto ('fuego') y
 * el resto enteros; unificarlo evita que '1' y 1 cuenten como visitas distintas
 * y rompan la deduplicación.
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
      `SELECT id, entity_type, entity_ref, viewed_at
         FROM history
        WHERE profile_id = ?
        ORDER BY datetime(viewed_at) DESC, id DESC
        LIMIT ?`
    ),
    // Última visita de esa entidad dentro de la ventana de deduplicación.
    // Se compara con datetime() y no con cadenas: viewed_at puede venir de
    // CURRENT_TIMESTAMP o de datetime('now'), y ambos formatos deben cuadrar.
    recent: db.prepare(
      `SELECT id, viewed_at
         FROM history
        WHERE profile_id = ? AND entity_type = ? AND entity_ref = ?
          AND datetime(viewed_at) > datetime('now', ?)
        ORDER BY datetime(viewed_at) DESC
        LIMIT 1`
    ),
    insert: db.prepare(
      `INSERT INTO history (profile_id, entity_type, entity_ref, viewed_at)
       VALUES (?, ?, ?, datetime('now'))`
    ),
    // Poda: se queda con las MAX_ROWS visitas más recientes del perfil.
    prune: db.prepare(
      `DELETE FROM history
        WHERE profile_id = ?
          AND id NOT IN (
            SELECT id FROM history
             WHERE profile_id = ?
             ORDER BY datetime(viewed_at) DESC, id DESC
             LIMIT ?
          )`
    ),
    clear: db.prepare(`DELETE FROM history WHERE profile_id = ?`),
    count: db.prepare(`SELECT COUNT(*) AS c FROM history WHERE profile_id = ?`),
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

  // GET /api/history?profile=1&limit=50 -> últimas visitas, de la más reciente
  // a la más antigua.
  router.get("/", (req, res) => {
    const profileId = profileFrom(req, res);
    if (!profileId) return;

    let limit = parseId(req.query.limit) || DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    res.json({
      profile_id: profileId,
      limit,
      items: q.list.all(profileId, limit),
    });
  });

  // POST /api/history?profile=1  { entity_type, entity_ref }
  //
  // Responde 200 tanto si registra como si deduplica; `registrado` dice cuál de
  // las dos cosas pasó. El frontend no necesita distinguirlo para funcionar,
  // pero así la prueba de humo puede comprobar la ventana de 5 minutos.
  router.post("/", (req, res) => {
    const profileId = profileFrom(req, res);
    if (!profileId) return;

    const entity = entityFrom(req.body || {}, res);
    if (!entity) return;

    const reciente = q.recent.get(
      profileId,
      entity.entityType,
      entity.entityRef,
      `-${DEDUPE_MINUTES} minutes`
    );

    if (reciente) {
      return res.json({
        ok: true,
        registrado: false,
        motivo: "duplicado_reciente",
        entity_type: entity.entityType,
        entity_ref: entity.entityRef,
      });
    }

    const info = q.insert.run(profileId, entity.entityType, entity.entityRef);
    q.prune.run(profileId, profileId, MAX_ROWS);

    res.json({
      ok: true,
      registrado: true,
      id: info.lastInsertRowid,
      entity_type: entity.entityType,
      entity_ref: entity.entityRef,
    });
  });

  // DELETE /api/history?profile=1 -> limpia el historial entero del perfil.
  // La confirmación la pide el frontend: aquí ya no hay vuelta atrás.
  router.delete("/", (req, res) => {
    const profileId = profileFrom(req, res);
    if (!profileId) return;

    const antes = q.count.get(profileId).c;
    q.clear.run(profileId);

    res.json({ ok: true, profile_id: profileId, borradas: antes });
  });

  return router;
};

// Se exportan para la prueba de humo (tests/history.smoke.js).
module.exports.DEDUPE_MINUTES = DEDUPE_MINUTES;
module.exports.MAX_ROWS = MAX_ROWS;
module.exports.ENTITY_TYPES = ENTITY_TYPES;
