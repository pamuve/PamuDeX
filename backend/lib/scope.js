"use strict";

/**
 * PamuDeX — el «ámbito» de un dato de usuario que depende del juego.
 *
 * Los equipos guardados y las capturas no son del perfil a secas: un equipo de
 * Radical Red no pinta nada en Elite Redux, y haber capturado a Pikachu en un
 * ROM Hack no lo captura en otro. El ámbito dice a cuál pertenecen:
 *
 *   global          sin sesión de ROM Hack ni modo Champions
 *   session:<id>    dentro de esa sesión
 *   champions:<id>  dentro de ese conjunto de reglas de Champions
 *
 * Es texto y no dos columnas (`session_id`, `champions_id`) porque así la clave
 * primaria de `captures` es una sola y no hay que tratar los NULL aparte.
 */
const FORMATO = /^(global|session:[1-9][0-9]{0,9}|champions:[1-9][0-9]{0,9})$/;

/** Devuelve el ámbito normalizado, o null si no es válido. Sin valor = global. */
function parseScope(raw) {
  if (raw === undefined || raw === null || raw === "") return "global";
  return typeof raw === "string" && FORMATO.test(raw) ? raw : null;
}

function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Lee `?profile=` y `?scope=` y responde el error si algo falla. Devuelve
 * `{ profileId, scope }` o null (y entonces ya se ha respondido).
 */
function createProfileScope(db) {
  const profileExists = db.prepare(`SELECT 1 FROM profiles WHERE id = ?`);
  return function profileScope(req, res) {
    const profileId = parseId(req.query.profile);
    if (!profileId) {
      res.status(400).json({ error: "perfil_requerido" });
      return null;
    }
    if (!profileExists.get(profileId)) {
      res.status(404).json({ error: "perfil_no_encontrado" });
      return null;
    }
    const scope = parseScope(req.query.scope);
    if (scope === null) {
      res.status(400).json({ error: "ambito_invalido" });
      return null;
    }
    return { profileId, scope };
  };
}

module.exports = { parseScope, parseId, createProfileScope };
