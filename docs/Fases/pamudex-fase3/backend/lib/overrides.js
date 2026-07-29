"use strict";

/**
 * PamuDeX — Tarea 3.2
 * Motor de overrides por sesión.
 *
 * Forma de sessions.data_json:
 * {
 *   "types":     { "fuego": { "name_es": "Llama", "color": "#FF5500" } },
 *   "pokemon":   { "25": { "stats": { "spe": 120 }, "types": ["electrico","hada"] } },
 *   "moves":     { "6": { "power": 110 } },
 *   "abilities": { "3": { "effect_es": "..." } },
 *   "relations": { "fuego": { "agua": 1 } },
 *   "theme":     { "base": "#0A1425", ... }        // tarea 3.5
 * }
 *
 * Regla: lo que no aparece en el override conserva el valor global.
 */

const ENTITY_KEYS = ["types", "pokemon", "moves", "abilities"];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Merge superficial con una excepción práctica: si en ambos lados la clave es
 * un objeto plano (caso de `stats`), se mezcla un nivel más adentro, para que
 * `{"stats":{"spe":120}}` cambie solo la velocidad y no borre el resto.
 */
function applyOverrides(baseEntity, override) {
  if (!isPlainObject(override)) return baseEntity;
  if (!isPlainObject(baseEntity)) return { ...override };

  const result = { ...baseEntity };
  for (const key of Object.keys(override)) {
    const incoming = override[key];
    const current = baseEntity[key];
    result[key] =
      isPlainObject(incoming) && isPlainObject(current)
        ? { ...current, ...incoming }
        : incoming;
  }
  return result;
}

/** Lee y parsea data_json de una sesión. Devuelve {} si no existe o está roto. */
function getSessionOverrides(db, sessionId) {
  const id = Number.parseInt(sessionId, 10);
  if (!Number.isInteger(id) || id <= 0) return {};
  try {
    const row = db.prepare("SELECT data_json FROM sessions WHERE id = ?").get(id);
    if (!row || !row.data_json) return {};
    const parsed = JSON.parse(row.data_json);
    return isPlainObject(parsed) ? parsed : {};
  } catch (err) {
    return {};
  }
}

/** Devuelve el override concreto de una entidad, o null. */
function overrideFor(overrides, entity, id) {
  if (!isPlainObject(overrides)) return null;
  const bucket = overrides[entity];
  if (!isPlainObject(bucket)) return null;
  const found = bucket[String(id)];
  return isPlainObject(found) ? found : null;
}

/** Aplica el override correspondiente a cada elemento de una lista. */
function applyToList(list, overrides, entity) {
  if (!Array.isArray(list)) return list;
  return list.map((item) => {
    if (!isPlainObject(item)) return item;
    const override = overrideFor(overrides, entity, item.id);
    return override ? applyOverrides(item, override) : item;
  });
}

module.exports = {
  ENTITY_KEYS,
  isPlainObject,
  applyOverrides,
  getSessionOverrides,
  overrideFor,
  applyToList,
};
