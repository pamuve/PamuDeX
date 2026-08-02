"use strict";

/**
 * PamuDeX — Tarea 4.1
 * Exportación del dataset a JSON y CSV, global o de una sesión.
 *
 * POR QUÉ NO PASA POR EL MIDDLEWARE DE SESIONES
 * ---------------------------------------------
 * `middleware/sessionOverrides.js` intercepta `res.json` y solo reconoce las
 * rutas /types, /pokemon, /moves y /abilities, devolviendo la forma de la API.
 * Aquí hace falta la forma de los **seeds** (`backend/data/*.json`), que es
 * distinta: sin `id`, con `type` en vez de `type_id`, `es`/`en` en vez de
 * `name_es`/`name_en` en los tipos, y `type_chart` anidado. Por eso se lee la
 * DB y se aplican los overrides aquí mismo con `lib/overrides.js`.
 *
 * El formato de salida es exactamente el que come `db/seed.js`, para que
 * exportar e importar sea simétrico (tareas 4.3 y 4.4).
 */

const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");
const { applyOverrides, getSessionOverrides, overrideFor } = require("../lib/overrides");
const { populate } = require("../db/populate");

const SCHEMA_PATH = path.join(__dirname, "..", "db", "schema.sql");

const ENTITIES = ["pokemon", "moves", "abilities", "types"];
const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"];

/* ------------------------------- utilidades ------------------------------- */

/** Nombre de archivo seguro: sin acentos, espacios ni signos raros. */
function slug(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "sesion";
}

function filename(sessionName, suffix, ext) {
  const fecha = new Date().toISOString().slice(0, 10);
  const parte = sessionName ? slug(sessionName) : "global";
  return `pamudex-${parte}${suffix ? `-${suffix}` : ""}-${fecha}.${ext}`;
}

/** RFC 4180: comillas dobles si hay coma, comilla, salto de línea o punto y coma. */
function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",;\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvCell(row[h])).join(","));
  // BOM: sin él, Excel abre los acentos como mojibake.
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/** El override guarda las habilidades como objetos; el formato seed, como nombres. */
function abilityNames(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => (typeof item === "string" ? item : item && typeof item === "object" ? item.name_es : ""))
    .filter(Boolean);
}

/* ------------------------------- constructores ----------------------------- */

function buildTypes(db, overrides) {
  return db
    .prepare("SELECT id, name_es, name_en, color FROM types ORDER BY id")
    .all()
    .map((row) => {
      const merged = applyOverrides(row, overrideFor(overrides, "types", row.id) || {});
      return { id: merged.id, es: merged.name_es, en: merged.name_en, color: merged.color };
    });
}

/**
 * type_chart sólo lista lo que NO vale 1, igual que el JSON semilla: seed.js
 * asume 1 para todo lo que no aparezca. Si un override devuelve una relación a
 * 1, aquí desaparece, que es exactamente lo correcto.
 */
function buildTypeChart(db, overrides) {
  const chart = {};
  for (const r of db.prepare("SELECT attacker_type, defender_type, multiplier FROM relations").all()) {
    if (!chart[r.attacker_type]) chart[r.attacker_type] = {};
    chart[r.attacker_type][r.defender_type] = r.multiplier;
  }

  const relations = overrides && overrides.relations;
  if (relations && typeof relations === "object") {
    for (const atk of Object.keys(relations)) {
      const row = relations[atk];
      if (!row || typeof row !== "object") continue;
      if (!chart[atk]) chart[atk] = {};
      for (const def of Object.keys(row)) {
        const mult = Number(row[def]);
        if (!Number.isNaN(mult)) chart[atk][def] = mult;
      }
    }
  }

  const out = {
    _comment:
      "Multiplicador de daño cuando el ATACANTE (clave externa) golpea al DEFENSOR (clave interna). Todo lo no listado vale 1 (normal).",
  };
  for (const atk of Object.keys(chart).sort()) {
    const row = {};
    for (const def of Object.keys(chart[atk]).sort()) {
      if (chart[atk][def] !== 1) row[def] = chart[atk][def];
    }
    if (Object.keys(row).length) out[atk] = row;
  }
  return out;
}

function buildPokemon(db, overrides) {
  const rows = db.prepare("SELECT * FROM pokemon ORDER BY dex").all();
  const typesOf = db.prepare(
    "SELECT type_id FROM pokemon_types WHERE pokemon_id = ? ORDER BY slot"
  );
  const abilitiesOf = db.prepare(
    `SELECT a.name_es, a.name_en, a.effect_es, pa.is_hidden
     FROM pokemon_abilities pa JOIN abilities a ON a.id = pa.ability_id
     WHERE pa.pokemon_id = ?`
  );

  return rows.map((p) => {
    const abilities = abilitiesOf.all(p.id);
    // Se arma primero la forma de la API para que los overrides (que se
    // guardaron contra esa forma) encajen sin traducción, y se convierte a
    // formato seed al final.
    const base = {
      dex: p.dex,
      name_es: p.name_es,
      name_en: p.name_en,
      generation: p.generation,
      types: typesOf.all(p.id).map((t) => t.type_id),
      abilities: abilities.filter((a) => !a.is_hidden),
      hidden_ability: abilities.find((a) => a.is_hidden) || null,
      stats: STAT_KEYS.reduce((acc, k) => ({ ...acc, [k]: p[k] }), {}),
      height_m: p.height_m,
      weight_kg: p.weight_kg,
    };
    const merged = applyOverrides(base, overrideFor(overrides, "pokemon", p.id) || {});

    return {
      dex: merged.dex,
      name_es: merged.name_es,
      name_en: merged.name_en,
      generation: merged.generation,
      types: Array.isArray(merged.types)
        ? merged.types.map((t) => (typeof t === "string" ? t : t && t.id)).filter(Boolean)
        : [],
      abilities: abilityNames(merged.abilities),
      hidden_ability: abilityNames(merged.hidden_ability)[0] || null,
      stats: STAT_KEYS.reduce((acc, k) => ({ ...acc, [k]: merged.stats ? merged.stats[k] : null }), {}),
      height_m: merged.height_m,
      weight_kg: merged.weight_kg,
    };
  });
}

function buildMoves(db, overrides) {
  return db
    .prepare("SELECT * FROM moves ORDER BY name_es")
    .all()
    .map((m) => {
      const merged = applyOverrides(m, overrideFor(overrides, "moves", m.id) || {});
      return {
        name_es: merged.name_es,
        name_en: merged.name_en,
        type: merged.type_id,
        category: merged.category,
        power: merged.power,
        accuracy: merged.accuracy,
        pp: merged.pp,
        priority: merged.priority,
        // null = desconocido, distinto de false. Se conserva tal cual.
        makes_contact: merged.makes_contact === null ? null : Boolean(merged.makes_contact),
        generation: merged.generation,
        effect_es: merged.effect_es,
      };
    });
}

function buildAbilities(db, overrides) {
  return db
    .prepare("SELECT * FROM abilities ORDER BY name_es")
    .all()
    .map((a) => {
      const merged = applyOverrides(a, overrideFor(overrides, "abilities", a.id) || {});
      return {
        name_es: merged.name_es,
        name_en: merged.name_en,
        generation: merged.generation,
        effect_es: merged.effect_es,
      };
    });
}

/* ---------------------------------- CSV ----------------------------------- */

const CSV = {
  pokemon: (rows) =>
    toCsv(
      ["dex", "name_es", "name_en", "generation", "type1", "type2", "abilities",
       "hidden_ability", ...STAT_KEYS, "height_m", "weight_kg"],
      rows.map((p) => ({
        ...p,
        type1: p.types[0] || "",
        type2: p.types[1] || "",
        // Separador "|": las listas no chocan con el separador de columnas ni
        // obligan a entrecomillar, y se reimportan sin ambigüedad en la 4.3.
        abilities: p.abilities.join("|"),
        ...p.stats,
      }))
    ),
  moves: (rows) =>
    toCsv(
      ["name_es", "name_en", "type", "category", "power", "accuracy", "pp",
       "priority", "makes_contact", "generation", "effect_es"],
      // makes_contact null se va como celda vacía: «desconocido», no «no».
      rows.map((m) => ({ ...m, makes_contact: m.makes_contact === null ? "" : m.makes_contact ? 1 : 0 }))
    ),
  abilities: (rows) => toCsv(["name_es", "name_en", "generation", "effect_es"], rows),
  types: (rows) => toCsv(["id", "es", "en", "color"], rows),
};

/* --------------------------------- rutas ---------------------------------- */

module.exports = (db) => {
  const router = express.Router();

  /** Resuelve la sesión pedida: devuelve sus overrides y su nombre. */
  function session(req) {
    const id = req.query.session;
    if (!id) return { overrides: {}, name: null };
    const row = db.prepare("SELECT name FROM sessions WHERE id = ?").get(Number.parseInt(id, 10));
    if (!row) return null;
    return { overrides: getSessionOverrides(db, id), name: row.name };
  }

  // GET /api/export/json[?session=<id>]
  router.get("/json", (req, res) => {
    const ctx = session(req);
    if (!ctx) return res.status(404).json({ error: "sesion_no_encontrada" });

    const payload = {
      types: buildTypes(db, ctx.overrides),
      type_chart: buildTypeChart(db, ctx.overrides),
      pokemon: buildPokemon(db, ctx.overrides),
      moves: buildMoves(db, ctx.overrides),
      abilities: buildAbilities(db, ctx.overrides),
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename(ctx.name, "", "json")}"`);
    res.send(JSON.stringify(payload, null, 2) + "\n");
  });

  // GET /api/export/csv?entity=pokemon|moves|abilities|types[&session=<id>]
  router.get("/csv", (req, res) => {
    const entity = String(req.query.entity || "");
    if (!ENTITIES.includes(entity)) {
      return res.status(400).json({ error: "entidad_invalida", validas: ENTITIES });
    }

    const ctx = session(req);
    if (!ctx) return res.status(404).json({ error: "sesion_no_encontrada" });

    const build = {
      pokemon: buildPokemon, moves: buildMoves,
      abilities: buildAbilities, types: buildTypes,
    }[entity];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename(ctx.name, entity, "csv")}"`);
    res.send(CSV[entity](build(db, ctx.overrides)));
  });

  // GET /api/export/sqlite[?session=<id>]
  //
  // Genera una base NUEVA con los overrides ya fusionados en las filas; nunca
  // copia `pamudex.sqlite`, que contiene los datos globales y además las
  // sesiones (que no tienen por qué viajar dentro de la exportación).
  //
  // El volcado usa el mismo `db/populate.js` que la siembra, así que el archivo
  // descargado es idéntico a sembrar el JSON de /api/export/json.
  router.get("/sqlite", (req, res) => {
    const ctx = session(req);
    if (!ctx) return res.status(404).json({ error: "sesion_no_encontrada" });

    // Nombre único: varias descargas simultáneas no pueden pisarse.
    const tmp = path.join(
      os.tmpdir(),
      `pamudex-export-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`
    );

    let limpiado = false;
    const limpiar = () => {
      if (limpiado) return;
      limpiado = true;
      fs.rm(tmp, { force: true }, () => {});
    };

    let out;
    try {
      out = new Database(tmp);
      out.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));
      populate(out, {
        types: buildTypes(db, ctx.overrides),
        typeChart: buildTypeChart(db, ctx.overrides),
        pokemon: buildPokemon(db, ctx.overrides),
        moves: buildMoves(db, ctx.overrides),
        abilities: buildAbilities(db, ctx.overrides),
      });
      out.close();
    } catch (err) {
      if (out) {
        try {
          out.close();
        } catch {
          /* ya cerrada */
        }
      }
      limpiar();
      return res.status(500).json({ error: "export_sqlite_fallido" });
    }

    // No se usa res.download: su callback depende de que el socket llegue a
    // cerrarse, y con descargas abortadas eso puede no ocurrir a tiempo,
    // dejando temporales sueltos.
    //
    // En su lugar se abre el descriptor y se DESVINCULA el archivo, los dos de
    // forma síncrona. A partir de ese unlinkSync ya no existe ninguna entrada
    // en el sistema de ficheros que pueda quedar huérfana —ni aunque el proceso
    // muera a mitad—, mientras que el descriptor sigue siendo válido y el
    // stream lee de él con normalidad. Es la garantía que pide el criterio de
    // aceptación, y no depende de ningún manejador de eventos.
    let fd;
    let size;
    try {
      fd = fs.openSync(tmp, "r");
      size = fs.fstatSync(fd).size;
      fs.unlinkSync(tmp); // POSIX: el fd sobrevive al borrado
      limpiado = true; // ya no hay nada que limpiar
    } catch (err) {
      if (fd !== undefined) {
        try {
          fs.closeSync(fd);
        } catch {
          /* ya cerrado */
        }
      }
      limpiar();
      return res.status(500).json({ error: "export_sqlite_fallido" });
    }

    const stream = fs.createReadStream(null, { fd, autoClose: true });

    // Si el cliente corta, hay que destruir el stream a mano: sin esto el
    // descriptor se queda vivo y, con suficientes descargas abortadas, el
    // servidor deja de responder.
    const cerrar = () => stream.destroy();
    res.once("close", cerrar);
    stream.once("error", () => {
      if (!res.headersSent) res.status(500).json({ error: "export_sqlite_fallido" });
      else res.destroy();
    });

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", size);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename(ctx.name, "", "sqlite")}"`
    );
    stream.pipe(res);
  });

  return router;
};
