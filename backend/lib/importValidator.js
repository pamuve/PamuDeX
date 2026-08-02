"use strict";

/**
 * PamuDeX — Tarea 4.3
 * Validación y diferencias de un dataset importado.
 *
 * El formato aceptado es exactamente el que produce `/api/export/json` (que a
 * su vez es el de `backend/data/*.json`), para que exportar e importar sean
 * simétricos: reimportar lo que acabas de exportar tiene que dar «0 cambios».
 *
 * Nada de este módulo escribe en la base: valida, compara y resume. Escribir es
 * cosa de `routes/import.js`, y solo después de que el usuario confirme.
 *
 * CLAVES NATURALES (cómo se decide si una entrada es alta o modificación)
 *   types      -> id           ("fuego")
 *   pokemon    -> dex          (nº de Pokédex; el id interno no viaja en el fichero)
 *   moves      -> name_en      invariante de idioma
 *   abilities  -> name_en      idem; es lo que ya usa tools/fetch-dataset.js
 */

const ENTITIES = ["types", "pokemon", "moves", "abilities"];
const CATEGORIES = ["fisico", "especial", "estado"];
const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"];
const KEY_OF = {
  types: (row) => (row.id === undefined || row.id === null ? null : String(row.id).toLowerCase()),
  pokemon: (row) => (Number.isInteger(Number(row.dex)) ? String(Number(row.dex)) : null),
  moves: (row) => (row.name_en ? String(row.name_en) : null),
  abilities: (row) => (row.name_en ? String(row.name_en) : null),
};

/* --------------------------------- CSV ------------------------------------ */

/** Parser RFC 4180: comillas dobles, "" escapado, CRLF o LF, BOM opcional. */
function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;
  const src = String(text).replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

/** Convierte las filas planas del CSV a la forma del JSON semilla. */
function csvToEntity(entity, rows) {
  if (!rows.length) return [];
  const headers = rows[0];
  const at = (row, name) => {
    const i = headers.indexOf(name);
    return i === -1 ? undefined : row[i];
  };

  return rows.slice(1).map((row) => {
    switch (entity) {
      case "types":
        return { id: at(row, "id"), es: at(row, "es"), en: at(row, "en"), color: at(row, "color") };
      case "pokemon":
        return {
          dex: num(at(row, "dex")),
          name_es: at(row, "name_es"),
          name_en: at(row, "name_en"),
          generation: num(at(row, "generation")),
          types: [at(row, "type1"), at(row, "type2")].filter((t) => t),
          // El export separa las listas con "|" para no chocar con la coma.
          abilities: String(at(row, "abilities") || "").split("|").map((s) => s.trim()).filter(Boolean),
          hidden_ability: at(row, "hidden_ability") || null,
          stats: STAT_KEYS.reduce((acc, k) => ({ ...acc, [k]: num(at(row, k)) }), {}),
          height_m: num(at(row, "height_m")),
          weight_kg: num(at(row, "weight_kg")),
        };
      case "moves":
        return {
          name_es: at(row, "name_es"),
          name_en: at(row, "name_en"),
          type: at(row, "type"),
          category: at(row, "category"),
          power: num(at(row, "power")),
          accuracy: num(at(row, "accuracy")),
          pp: num(at(row, "pp")),
          priority: num(at(row, "priority")) ?? 0,
          // Celda vacía = desconocido, que NO es lo mismo que «no hace contacto».
          makes_contact: at(row, "makes_contact") === "" || at(row, "makes_contact") === undefined
            ? null
            : Boolean(num(at(row, "makes_contact"))),
          generation: num(at(row, "generation")),
          effect_es: at(row, "effect_es") || null,
        };
      case "abilities":
        return {
          name_es: at(row, "name_es"),
          name_en: at(row, "name_en"),
          generation: num(at(row, "generation")),
          effect_es: at(row, "effect_es") || null,
        };
      default:
        return {};
    }
  });
}

/* ------------------------------ validación -------------------------------- */

function validateRow(entity, row, index, typeIds, errors) {
  const donde = `${entity}[${index}]`;
  const falta = (campo) => errors.push({ entity, index, field: campo, code: "requerido", message: `${donde}: falta «${campo}»` });
  const malo = (campo, detalle) => errors.push({ entity, index, field: campo, code: "invalido", message: `${donde}: ${campo} ${detalle}` });
  const texto = (v) => typeof v === "string" && v.trim() !== "";

  if (entity === "types") {
    if (!texto(row.id)) falta("id");
    if (!texto(row.es)) falta("es");
    if (!texto(row.en)) falta("en");
    if (!texto(row.color)) falta("color");
    else if (!/^#[0-9a-fA-F]{6}$/.test(row.color)) malo("color", "no es #RRGGBB");
    return;
  }

  if (entity === "pokemon") {
    const dex = Number(row.dex);
    if (row.dex === undefined || row.dex === null || row.dex === "") falta("dex");
    else if (!Number.isInteger(dex) || dex <= 0) malo("dex", "tiene que ser un entero mayor que 0");
    if (!texto(row.name_es)) falta("name_es");
    if (!texto(row.name_en)) falta("name_en");

    const gen = Number(row.generation);
    if (!Number.isInteger(gen) || gen < 1 || gen > 9) malo("generation", "tiene que estar entre 1 y 9");

    if (!Array.isArray(row.types) || row.types.length === 0) falta("types");
    else {
      if (row.types.length > 2) malo("types", "no puede tener más de 2");
      const desconocidos = row.types.filter((t) => !typeIds.has(String(t).toLowerCase()));
      if (desconocidos.length) malo("types", `contiene tipos desconocidos: ${desconocidos.join(", ")}`);
      if (row.types.length === 2 && row.types[0] === row.types[1]) malo("types", "no puede repetir el mismo tipo");
    }

    if (!row.stats || typeof row.stats !== "object") falta("stats");
    else {
      for (const k of STAT_KEYS) {
        const v = Number(row.stats[k]);
        if (!Number.isInteger(v) || v < 1 || v > 255) malo(`stats.${k}`, "tiene que ser un entero entre 1 y 255");
      }
    }
    if (row.height_m !== null && row.height_m !== undefined && Number(row.height_m) < 0) malo("height_m", "no puede ser negativa");
    if (row.weight_kg !== null && row.weight_kg !== undefined && Number(row.weight_kg) < 0) malo("weight_kg", "no puede ser negativo");
    return;
  }

  if (entity === "moves") {
    if (!texto(row.name_es)) falta("name_es");
    if (!texto(row.name_en)) falta("name_en");
    if (!texto(row.type)) falta("type");
    else if (!typeIds.has(String(row.type).toLowerCase())) malo("type", `«${row.type}» no es un tipo conocido`);
    if (!texto(row.category)) falta("category");
    else if (!CATEGORIES.includes(row.category)) malo("category", `tiene que ser ${CATEGORIES.join(", ")}`);
    if (row.power !== null && row.power !== undefined && (Number(row.power) < 0 || Number(row.power) > 999)) malo("power", "fuera de rango (0-999)");
    if (row.accuracy !== null && row.accuracy !== undefined && (Number(row.accuracy) < 0 || Number(row.accuracy) > 100)) malo("accuracy", "fuera de rango (0-100)");
    if (row.pp !== null && row.pp !== undefined && Number(row.pp) < 1) malo("pp", "tiene que ser mayor que 0");
    const pr = Number(row.priority ?? 0);
    if (!Number.isInteger(pr) || pr < -7 || pr > 7) malo("priority", "fuera de rango (-7 a 7)");
    return;
  }

  if (entity === "abilities") {
    if (!texto(row.name_es)) falta("name_es");
    if (!texto(row.name_en)) falta("name_en");
  }
}

/**
 * Valida un dataset completo. `dataset` es { types?, pokemon?, moves?,
 * abilities? }: se admiten importaciones parciales (por ejemplo un solo CSV).
 */
function validate(dataset, typeIdsFromDb) {
  const errors = [];
  const warnings = [];

  // Los tipos que trae el propio fichero también valen para validar referencias.
  const typeIds = new Set(typeIdsFromDb);
  if (Array.isArray(dataset.types)) {
    for (const t of dataset.types) if (t && t.id) typeIds.add(String(t.id).toLowerCase());
  }

  let algo = false;
  for (const entity of ENTITIES) {
    const rows = dataset[entity];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) {
      errors.push({ entity, code: "formato", message: `«${entity}» tiene que ser una lista` });
      continue;
    }
    algo = true;

    const vistos = new Map();
    rows.forEach((row, i) => {
      if (!row || typeof row !== "object") {
        errors.push({ entity, index: i, code: "formato", message: `${entity}[${i}]: no es un objeto` });
        return;
      }
      validateRow(entity, row, i, typeIds, errors);

      const key = KEY_OF[entity](row);
      if (key !== null) {
        if (vistos.has(key)) {
          errors.push({
            entity, index: i, code: "duplicado",
            message: `${entity}[${i}]: «${key}» está repetido (también en la posición ${vistos.get(key)})`,
          });
        } else vistos.set(key, i);
      }
    });
  }

  if (!algo) {
    errors.push({ code: "vacio", message: "El archivo no contiene ninguna entidad reconocible (types, pokemon, moves, abilities)." });
  }

  // Habilidades nombradas por un Pokémon que no vienen en el fichero ni existen
  // ya: no bloquea (populate las crea vacías), pero conviene avisar.
  if (Array.isArray(dataset.pokemon) && Array.isArray(dataset.abilities)) {
    const conocidas = new Set(dataset.abilities.map((a) => a && a.name_es).filter(Boolean));
    const sueltas = new Set();
    for (const p of dataset.pokemon) {
      if (!p) continue;
      for (const n of [...(p.abilities || []), p.hidden_ability]) {
        if (n && !conocidas.has(n)) sueltas.add(n);
      }
    }
    if (sueltas.size) {
      warnings.push({
        code: "habilidades_sin_ficha",
        message: `${sueltas.size} habilidad(es) mencionadas por algún Pokémon no traen ficha propia: ${[...sueltas].slice(0, 5).join(", ")}${sueltas.size > 5 ? "…" : ""}`,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/* ------------------------------- diferencias ------------------------------- */

/** Compara sin distinguir null de undefined, y con los números como números. */
function igual(a, b) {
  const norm = (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (Array.isArray(v)) return v.map(norm);
    if (typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = norm(v[k]);
      return out;
    }
    const n = Number(v);
    return v !== "" && !Number.isNaN(n) ? n : v;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/** Campos que se comparan por entidad, en la forma del fichero semilla. */
const CAMPOS = {
  types: ["es", "en", "color"],
  pokemon: ["name_es", "name_en", "generation", "types", "abilities", "hidden_ability", "stats", "height_m", "weight_kg"],
  moves: ["name_es", "type", "category", "power", "accuracy", "pp", "priority", "makes_contact", "generation", "effect_es"],
  abilities: ["name_es", "generation", "effect_es"],
};

/**
 * Compara el dataset entrante contra el actual y resume qué cambiaría.
 * `actual` es { types, pokemon, moves, abilities } en formato semilla — el
 * mismo que devuelve `/api/export/json`, así que reimportar un export propio da
 * added=0, updated=0.
 */
function diff(dataset, actual) {
  const summary = {};
  const examples = {};

  for (const entity of ENTITIES) {
    const rows = dataset[entity];
    if (rows === undefined) continue;

    const actuales = new Map();
    for (const row of actual[entity] || []) {
      const k = KEY_OF[entity](row);
      if (k !== null) actuales.set(k, row);
    }

    let added = 0, updated = 0, unchanged = 0;
    const ejemplos = { added: [], updated: [] };

    for (const row of rows) {
      const key = KEY_OF[entity](row);
      if (key === null) continue;
      const antes = actuales.get(key);
      if (!antes) {
        added++;
        if (ejemplos.added.length < 5) ejemplos.added.push({ key, name: row.name_es || row.es || key });
        continue;
      }
      const cambios = CAMPOS[entity].filter((f) => !igual(row[f], antes[f]));
      if (cambios.length) {
        updated++;
        if (ejemplos.updated.length < 5) {
          ejemplos.updated.push({ key, name: row.name_es || row.es || key, fields: cambios });
        }
      } else unchanged++;
    }

    summary[entity] = { added, updated, unchanged, total: rows.length };
    examples[entity] = ejemplos;
  }

  return { summary, examples };
}

module.exports = { ENTITIES, KEY_OF, CAMPOS, parseCsv, csvToEntity, validate, diff, igual };
