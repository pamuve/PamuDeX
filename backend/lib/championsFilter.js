"use strict";

/**
 * PamuDeX — Tarea 6.1
 * Filtrado del catálogo global según un conjunto de reglas de Pokémon Champions.
 *
 * Tabla (backend/db/schema.sql):
 *   champions_rules(id, name, allowed_pokemon_json, allowed_items_json,
 *                   allowed_moves_json, allowed_abilities_json,
 *                   custom_multipliers_json)
 *
 * NULL NO ES LO MISMO QUE LISTA VACÍA
 * -----------------------------------
 * Es la decisión de diseño de esta tarea, y conviene tenerla clara antes de
 * tocar nada:
 *
 *   columna NULL  ->  SIN RESTRICCIÓN. Vale todo el catálogo.
 *   `[]`          ->  NADA permitido de esa entidad.
 *   `[1, 4, 7]`   ->  solo esos.
 *
 * El motivo es que un conjunto de reglas recién creado sea usable: si «vacío»
 * significara «nada permitido», crear un conjunto dejaría el modo sin un solo
 * Pokémon y habría que marcar 1025 casillas antes de poder consultar nada. Con
 * NULL se empieza permitiendo todo y se restringe lo que interese, entidad por
 * entidad — un formato que solo limita objetos no tiene que decir nada sobre
 * los movimientos.
 *
 * Es la misma idea que los overrides de sesión de la Fase 3 («lo que no aparece
 * conserva su valor global»), aplicada a la inversa.
 *
 * ESTO LEE EL CATÁLOGO GLOBAL, SIN OVERRIDES DE SESIÓN
 * ----------------------------------------------------
 * A propósito: Champions y las sesiones de ROM Hack son **excluyentes** (ver
 * `docs/tasks/fase6/00-preparacion.md`). Champions es otro juego, no un ROM Hack
 * del mismo, así que mezclar los tipos reescritos de Radical Red con las reglas
 * de Champions no significaría nada.
 */

/** Entidades que un conjunto de reglas puede limitar. */
const ENTITIES = ["pokemon", "moves", "abilities", "items"];

/** Entidad -> columna de la tabla. */
const COLUMN = {
  pokemon: "allowed_pokemon_json",
  moves: "allowed_moves_json",
  abilities: "allowed_abilities_json",
  items: "allowed_items_json",
};

/** Tope por entidad. El catálogo más grande son 2151 objetos. */
const MAX_IDS = 5000;

/**
 * Convierte el JSON guardado en un Set de ids (como cadenas).
 * Devuelve `null` cuando no hay restricción — ojo, `null` y `new Set()` son
 * cosas distintas aquí.
 */
function parseAllowed(json) {
  if (json === null || json === undefined || json === "") return null;

  let parsed;
  try {
    parsed = typeof json === "string" ? JSON.parse(json) : json;
  } catch (err) {
    // Un JSON corrupto se trata como «sin restricción» en vez de dejar el modo
    // sin contenido: es el fallo más benigno de los dos.
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  return new Set(parsed.map((id) => String(id)));
}

/**
 * Valida y normaliza una lista de ids entrante.
 * Devuelve `{ ok: true, json }` (con `json` = null o cadena JSON) o
 * `{ ok: false, error }`.
 */
function serializeAllowed(value) {
  if (value === null) return { ok: true, json: null };
  if (!Array.isArray(value)) return { ok: false, error: "lista_invalida" };
  if (value.length > MAX_IDS) return { ok: false, error: "lista_demasiado_larga" };

  const ids = [];
  const vistos = new Set();
  for (const raw of value) {
    const id = Number.parseInt(raw, 10);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "id_invalido" };
    if (vistos.has(id)) continue; // marcar dos veces lo mismo no es un error
    vistos.add(id);
    ids.push(id);
  }
  // Ordenados: así el JSON guardado no cambia solo porque el usuario marcara
  // las casillas en otro orden, y los diffs de la base son legibles.
  ids.sort((a, b) => a - b);
  return { ok: true, json: JSON.stringify(ids) };
}

/** ¿Este conjunto permite esa entidad? Sin restricción, todo vale. */
function allows(allowed, id) {
  if (allowed === null) return true;
  return allowed.has(String(id));
}

/**
 * Filtra un listado del catálogo. `list` es lo que devolvería la ruta normal.
 * Sin restricción devuelve exactamente la misma lista (misma referencia no,
 * pero mismo contenido y mismo orden).
 */
function filterList(list, allowed, idKey = "id") {
  if (allowed === null) return list;
  return list.filter((row) => allows(allowed, row[idKey]));
}

/**
 * Pasa una fila de `champions_rules` a la forma que devuelve la API.
 *
 * `allowed.<entidad>` es un array de ids o `null` (sin restricción), y
 * `counts.<entidad>` dice cuántos hay marcados o `null`, para que el listado
 * pueda resumir un conjunto sin descargar miles de ids.
 */
function readRules(row) {
  if (!row) return null;

  const allowed = {};
  const counts = {};
  for (const entity of ENTITIES) {
    const set = parseAllowed(row[COLUMN[entity]]);
    allowed[entity] = set === null ? null : [...set].map(Number).sort((a, b) => a - b);
    counts[entity] = set === null ? null : set.size;
  }

  // Los multiplicadores propios son de la tarea 6.2: aquí solo se leen y se
  // devuelven tal cual para no perderlos, no se editan.
  let multipliers = null;
  try {
    multipliers = row.custom_multipliers_json ? JSON.parse(row.custom_multipliers_json) : null;
  } catch (err) {
    multipliers = null;
  }

  return { id: row.id, name: row.name, allowed, counts, multipliers };
}

/**
 * Lecturas del catálogo global, con la MISMA forma y el MISMO orden que los
 * listados de `/api/pokemon`, `/api/moves`, `/api/abilities` y `/api/items`.
 *
 * Se repiten aquí los SELECT en vez de llamar a esas rutas porque un router de
 * Express no es invocable como función sin montar una petición falsa. Si cambia
 * la forma de un listado, hay que cambiarla en los dos sitios: por eso están
 * juntos y anotados.
 */
function catalog(db) {
  const q = {
    pokemon: db.prepare(
      `SELECT p.id, p.dex, p.name_es, p.name_en, p.generation
         FROM pokemon p ORDER BY p.dex ASC`
    ),
    moves: db.prepare(
      `SELECT m.id, m.name_es, m.name_en, m.type_id, t.color, m.category, m.power, m.accuracy, m.pp
         FROM moves m JOIN types t ON t.id = m.type_id ORDER BY m.name_es`
    ),
    abilities: db.prepare(`SELECT id, name_es, name_en FROM abilities ORDER BY name_es`),
    items: db.prepare(`SELECT id, name_es, name_en, category FROM items ORDER BY name_es`),
  };

  return {
    pokemon: () => q.pokemon.all(),
    moves: () => q.moves.all(),
    abilities: () => q.abilities.all(),
    items: () => q.items.all(),
  };
}

module.exports = {
  ENTITIES,
  COLUMN,
  MAX_IDS,
  parseAllowed,
  serializeAllowed,
  allows,
  filterList,
  readRules,
  catalog,
};
