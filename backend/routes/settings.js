"use strict";

/**
 * PamuDeX — Tarea 5.4
 * Ajustes por perfil (pares clave/valor).
 *
 * Tabla (backend/db/schema.sql):
 *   settings(profile_id, key, value)  ·  PRIMARY KEY (profile_id, key)
 *
 * QUÉ VA AQUÍ Y QUÉ NO — DECISIÓN DE LA 5.4
 * -----------------------------------------
 * El idioma y el tema NO viven aquí: son columnas de `profiles`
 * (`profiles.language`, `profiles.theme`), que ya existían desde la 5.1 y que
 * la API de perfiles ya acepta en POST y PUT. El motivo es práctico: el
 * frontend cachea el perfil ENTERO en localStorage, así que idioma y tema están
 * disponibles en el primer render y sin conexión, sin una petición de más.
 * Guardarlos también en `settings` solo podría producir incoherencias.
 *
 * `settings` se reserva para las preferencias que no merecen una columna
 * propia. Hoy son tres, declaradas en ALLOWED_KEYS:
 *   - `active_session`   qué sesión de ROM Hack usa este perfil ("" = ninguna)
 *   - `history_enabled`  "1" | "0", para poder desactivar el registro de visitas
 *   - `champions_rules`  qué conjunto de reglas de Champions usa ("" = ninguno)
 *
 * Los conjuntos de reglas en sí son del hogar (`champions_rules` no tiene
 * `profile_id`): lo que es de cada perfil es CUÁL tiene puesto.
 *
 * LA LISTA BLANCA ES INTENCIONADA. Una tabla clave/valor abierta acaba siendo
 * un cajón de sastre imposible de auditar; añadir una preferencia nueva es
 * añadir su clave aquí, y de paso obliga a pensar si no le corresponde una
 * columna en `profiles`.
 *
 * LA RUTA LLEVA EL PERFIL EN LA URL, NO EN LA QUERY
 * -------------------------------------------------
 * `/api/settings/:profileId`, a diferencia de `/api/favorites?profile=` y
 * `/api/history?profile=`. No es un descuido: aquellos son colecciones que se
 * filtran por perfil, y esto es un único documento que PERTENECE al perfil.
 *
 * Convención del proyecto: el módulo exporta (db) => router y se monta en server.js.
 */

const express = require("express");

/**
 * Claves admitidas. Cualquier otra se rechaza con `clave_invalida`.
 * Añadir una preferencia nueva = añadirla aquí (y documentarla arriba).
 */
const ALLOWED_KEYS = ["active_session", "history_enabled", "champions_rules"];

/** Valores por defecto, para que el frontend no tenga que repetirlos. */
const DEFAULTS = {
  active_session: "",
  history_enabled: "1",
  champions_rules: "",
};

const MAX_VALUE = 200;

/** Convierte el :profileId de la URL en entero positivo, o null si no vale. */
function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Normaliza un valor a texto.
 * SQLite guarda TEXT, así que números y booleanos se convierten aquí en vez de
 * dejar que cada cliente elija su formato: "1"/"0" para los booleanos.
 */
function cleanValue(value) {
  if (value === true) return "1";
  if (value === false) return "0";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  return value.trim().slice(0, MAX_VALUE);
}

module.exports = (db) => {
  const router = express.Router();

  const q = {
    list: db.prepare(`SELECT key, value FROM settings WHERE profile_id = ?`),
    upsert: db.prepare(
      `INSERT INTO settings (profile_id, key, value)
       VALUES (?, ?, ?)
       ON CONFLICT (profile_id, key) DO UPDATE SET value = excluded.value`
    ),
    remove: db.prepare(`DELETE FROM settings WHERE profile_id = ? AND key = ?`),
    profileExists: db.prepare(`SELECT 1 FROM profiles WHERE id = ?`),
  };

  /** Ajustes del perfil, con los valores por defecto ya rellenados. */
  function settingsOf(profileId) {
    const stored = {};
    for (const row of q.list.all(profileId)) stored[row.key] = row.value;
    return { ...DEFAULTS, ...stored };
  }

  /**
   * Saca el perfil de la URL y comprueba que existe.
   * Devuelve el id, o null tras haber respondido ya con el error.
   */
  function profileFrom(req, res) {
    const profileId = parseId(req.params.profileId);
    if (!profileId) {
      res.status(400).json({ error: "id_invalido" });
      return null;
    }
    if (!q.profileExists.get(profileId)) {
      res.status(404).json({ error: "perfil_no_encontrado" });
      return null;
    }
    return profileId;
  }

  // GET /api/settings/1 -> { profile_id, settings: { clave: valor } }
  router.get("/:profileId", (req, res) => {
    const profileId = profileFrom(req, res);
    if (!profileId) return;

    res.json({ profile_id: profileId, settings: settingsOf(profileId) });
  });

  // PUT /api/settings/1  { history_enabled: "0", active_session: 3 }
  //
  // Es una FUSIÓN, no un reemplazo: lo que no venga en el cuerpo conserva su
  // valor. Enviar `null` en una clave la borra (vuelve a su valor por defecto).
  // Devuelve el conjunto completo ya resuelto, para que el frontend actualice
  // su caché sin tener que pedirlo otra vez.
  router.put("/:profileId", (req, res) => {
    const profileId = profileFrom(req, res);
    if (!profileId) return;

    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ error: "cuerpo_invalido" });
    }

    const keys = Object.keys(body);
    if (!keys.length) return res.status(400).json({ error: "sin_claves" });

    const invalida = keys.find((key) => !ALLOWED_KEYS.includes(key));
    if (invalida) return res.status(400).json({ error: "clave_invalida", key: invalida });

    // Todo o nada: si una clave falla, no se queda medio guardado.
    const guardar = db.transaction((pares) => {
      for (const [key, raw] of pares) {
        if (raw === null) {
          q.remove.run(profileId, key);
          continue;
        }
        const value = cleanValue(raw);
        if (value === null) throw new Error("valor_invalido");
        q.upsert.run(profileId, key, value);
      }
    });

    try {
      guardar(keys.map((key) => [key, body[key]]));
    } catch (err) {
      return res.status(400).json({ error: err.message || "valor_invalido" });
    }

    res.json({ profile_id: profileId, settings: settingsOf(profileId) });
  });

  return router;
};

// Se exportan para la prueba de humo (tests/history.smoke.js).
module.exports.ALLOWED_KEYS = ALLOWED_KEYS;
module.exports.DEFAULTS = DEFAULTS;
