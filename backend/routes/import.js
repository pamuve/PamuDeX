"use strict";

/**
 * PamuDeX — Tareas 4.3 y 4.4
 * Importación de datasets: JSON, CSV y SQLite.
 *
 * FLUJO: previsualizar -> confirmar -> aplicar. Nunca se escribe en `preview`.
 *
 * SIN ESTADO ENTRE LOS DOS PASOS
 * ------------------------------
 * `apply` no confía en nada guardado por `preview`: vuelve a parsear, validar y
 * comparar el archivo desde cero. Cuesta una subida más, pero garantiza que no
 * se puede aplicar algo que no acaba de pasar la validación, y evita cachés con
 * TTL que haya que limpiar.
 *
 * SUBIDA EN CRUDO, SIN MULTIPART
 * ------------------------------
 * El cuerpo se recibe con `express.raw` y los metadatos van en la query. Así no
 * hace falta añadir multer al contenedor, que es de una sola imagen y
 * offline-first, y el frontend simplemente hace `fetch(url, { body: file })`.
 *
 * DESTINO
 * -------
 * - `target=session`: las diferencias contra el dato global se guardan como
 *   overrides en `sessions.data_json`. Los overrides PARCHEAN filas existentes,
 *   así que las ALTAS no son representables aquí: se informan y se omiten.
 * - `target=global`: reescribe las tablas de datos. Es destructivo y por eso la
 *   UI pide una confirmación aparte.
 */

const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");
const { getSessionOverrides } = require("../lib/overrides");
const { buildDataset, STAT_KEYS } = require("../lib/dataset");
const { populate } = require("../db/populate");
const {
  ENTITIES, KEY_OF, CAMPOS, parseCsv, csvToEntity, validate, diff, igual,
} = require("../lib/importValidator");

const LIMITE = "50mb";
const SCHEMA_PATH = path.join(__dirname, "..", "db", "schema.sql");
const MAGIC = Buffer.from("SQLite format 3\0", "binary");

/** Tablas y columnas mínimas para que un .sqlite ajeno sea legible. */
const REQUERIDO = {
  types: ["id", "name_es", "name_en", "color"],
  relations: ["attacker_type", "defender_type", "multiplier"],
  pokemon: ["dex", "name_es", "name_en", "generation", "hp", "atk", "def", "spa", "spd", "spe"],
  pokemon_types: ["pokemon_id", "type_id", "slot"],
  pokemon_abilities: ["pokemon_id", "ability_id", "is_hidden"],
  moves: ["name_es", "name_en", "type_id", "category"],
  abilities: ["name_es", "name_en"],
};

/* ------------------------------- utilidades ------------------------------- */

function parseBody(buffer, format, entity) {
  if (format === "csv") {
    if (!ENTITIES.includes(entity)) {
      const err = new Error("entidad_invalida");
      err.detalle = `Para CSV hay que indicar entity=${ENTITIES.join("|")}`;
      throw err;
    }
    return { [entity]: csvToEntity(entity, parseCsv(buffer.toString("utf-8"))) };
  }

  let json;
  try {
    json = JSON.parse(buffer.toString("utf-8"));
  } catch (err) {
    const e = new Error("json_invalido");
    e.detalle = err.message;
    throw e;
  }
  // Se acepta el fichero completo { types, pokemon, ... } y también un array
  // suelto si se indica la entidad (un backend/data/*.json por su cuenta).
  if (Array.isArray(json)) {
    if (!ENTITIES.includes(entity)) {
      const e = new Error("entidad_invalida");
      e.detalle = "El archivo es una lista suelta: indica a qué entidad corresponde con entity=";
      throw e;
    }
    return { [entity]: json };
  }
  if (!json || typeof json !== "object") {
    const e = new Error("json_invalido");
    e.detalle = "La raíz tiene que ser un objeto o una lista";
    throw e;
  }
  const out = {};
  for (const k of ENTITIES) if (json[k] !== undefined) out[k] = json[k];
  if (json.type_chart !== undefined) out.type_chart = json.type_chart;
  return out;
}

/** Índices clave-natural -> id interno, para poder escribir los overrides. */
function indices(db) {
  return {
    types: new Map(db.prepare("SELECT id FROM types").all().map((r) => [String(r.id), r.id])),
    pokemon: new Map(db.prepare("SELECT id, dex FROM pokemon").all().map((r) => [String(r.dex), r.id])),
    moves: new Map(db.prepare("SELECT id, name_en FROM moves").all().map((r) => [r.name_en, r.id])),
    abilities: new Map(db.prepare("SELECT id, name_en FROM abilities").all().map((r) => [r.name_en, r.id])),
  };
}

/**
 * Traduce una fila en formato semilla a un override en FORMA DE API, que es la
 * que espera el middleware de sesiones. Solo incluye lo que difiere del global.
 */
function aOverride(entity, fila, actual, abilityByName) {
  const patch = {};
  const distinto = (campo) => !igual(fila[campo], actual[campo]);

  if (entity === "types") {
    if (distinto("es")) patch.name_es = fila.es;
    if (distinto("en")) patch.name_en = fila.en;
    if (distinto("color")) patch.color = fila.color;
    return patch;
  }

  if (entity === "pokemon") {
    for (const [origen, destino] of [["name_es", "name_es"], ["name_en", "name_en"],
      ["generation", "generation"], ["height_m", "height_m"], ["weight_kg", "weight_kg"]]) {
      if (distinto(origen)) patch[destino] = fila[origen];
    }
    if (distinto("types")) patch.types = fila.types;
    if (distinto("stats")) {
      patch.stats = STAT_KEYS.reduce((acc, k) => ({ ...acc, [k]: Number(fila.stats[k]) }), {});
    }
    // La API devuelve las habilidades como objetos; el fichero, como nombres.
    if (distinto("abilities")) {
      patch.abilities = (fila.abilities || []).map((n) => abilityByName.get(n) || { name_es: n, name_en: n, effect_es: "", is_hidden: 0 });
    }
    if (distinto("hidden_ability")) {
      patch.hidden_ability = fila.hidden_ability
        ? abilityByName.get(fila.hidden_ability) || { name_es: fila.hidden_ability, name_en: fila.hidden_ability, effect_es: "", is_hidden: 1 }
        : null;
    }
    return patch;
  }

  if (entity === "moves") {
    if (distinto("name_es")) patch.name_es = fila.name_es;
    if (distinto("type")) patch.type_id = fila.type;
    for (const c of ["category", "power", "accuracy", "pp", "priority", "generation", "effect_es"]) {
      if (distinto(c)) patch[c] = fila[c];
    }
    if (distinto("makes_contact")) {
      patch.makes_contact = fila.makes_contact === null ? null : fila.makes_contact ? 1 : 0;
    }
    return patch;
  }

  // abilities
  for (const c of ["name_es", "generation", "effect_es"]) if (distinto(c)) patch[c] = fila[c];
  return patch;
}

/* --------------------------------- rutas ---------------------------------- */

module.exports = (db) => {
  const router = express.Router();
  const crudo = express.raw({ type: () => true, limit: LIMITE });

  function contexto(req) {
    const target = req.query.target === "global" ? "global" : "session";
    const sessionId = req.query.session ? Number.parseInt(req.query.session, 10) : null;
    if (target === "session") {
      if (!sessionId) return { error: "sesion_requerida" };
      const row = db.prepare("SELECT id, name FROM sessions WHERE id = ?").get(sessionId);
      if (!row) return { error: "sesion_no_encontrada" };
      return { target, sessionId, name: row.name, overrides: getSessionOverrides(db, sessionId) };
    }
    return { target, sessionId: null, name: null, overrides: {} };
  }

  /** Valida + compara. No escribe nada. Compartido por preview y apply. */
  function analizar(dataset, ctx) {
    const typeIds = db.prepare("SELECT id FROM types").all().map((r) => String(r.id));
    const validacion = validate(dataset, typeIds);
    // Se compara contra lo que vería el destino: el global, o el global con los
    // overrides de la sesión ya aplicados.
    const actual = buildDataset(db, ctx.overrides);
    const { summary, examples } = diff(dataset, actual);

    const avisos = [...validacion.warnings];
    if (ctx.target === "session") {
      const altas = ENTITIES.reduce((n, e) => n + (summary[e] ? summary[e].added : 0), 0);
      if (altas > 0) {
        avisos.push({
          code: "altas_no_aplicables_en_sesion",
          message:
            `${altas} entrada(s) nuevas no se pueden añadir dentro de una sesión: los overrides modifican ` +
            `filas existentes, no crean nuevas. Se omitirán. Para darlas de alta, importa al dataset global.`,
        });
      }
    }
    return { ...validacion, warnings: avisos, summary, examples, actual };
  }

  // POST /api/import/preview?format=json|csv[&entity=][&target=session|global][&session=]
  router.post("/preview", crudo, (req, res) => {
    const ctx = contexto(req);
    if (ctx.error) return res.status(ctx.error === "sesion_no_encontrada" ? 404 : 400).json({ error: ctx.error });

    let dataset;
    try {
      dataset = parseBody(req.body, req.query.format === "csv" ? "csv" : "json", req.query.entity);
    } catch (err) {
      return res.status(400).json({ error: err.message, detalle: err.detalle, valid: false });
    }

    const r = analizar(dataset, ctx);
    res.json({
      valid: r.valid, errors: r.errors, warnings: r.warnings,
      summary: r.summary, examples: r.examples,
      target: ctx.target, session: ctx.name,
    });
  });

  // POST /api/import/apply?... (mismos parámetros que preview)
  router.post("/apply", crudo, (req, res) => {
    const ctx = contexto(req);
    if (ctx.error) return res.status(ctx.error === "sesion_no_encontrada" ? 404 : 400).json({ error: ctx.error });

    let dataset;
    try {
      dataset = parseBody(req.body, req.query.format === "csv" ? "csv" : "json", req.query.entity);
    } catch (err) {
      return res.status(400).json({ error: err.message, detalle: err.detalle });
    }

    const r = analizar(dataset, ctx);
    if (!r.valid) return res.status(422).json({ error: "validacion_fallida", errors: r.errors });

    try {
      const aplicado = aplicar(dataset, ctx, r, req.query.mode === "replace" ? "replace" : "merge");
      res.json({ ok: true, ...aplicado });
    } catch (err) {
      res.status(500).json({ error: "aplicacion_fallida", detalle: err.message });
    }
  });

  /* ------------------------------ 4.4: SQLite ----------------------------- */

  /** Guarda el cuerpo en un temporal, lo valida y lo abre en SOLO LECTURA. */
  function abrirSubido(buffer) {
    if (!buffer || buffer.length < MAGIC.length || !buffer.subarray(0, MAGIC.length).equals(MAGIC)) {
      const e = new Error("no_es_sqlite");
      e.detalle = "El archivo no empieza por la cabecera «SQLite format 3».";
      throw e;
    }

    const tmp = path.join(
      os.tmpdir(),
      `pamudex-import-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`
    );
    fs.writeFileSync(tmp, buffer);

    let externa;
    try {
      // Solo lectura: un .sqlite subido es código ajeno en la práctica.
      externa = new Database(tmp, { readonly: true, fileMustExist: true });
      const faltan = [];
      for (const [tabla, columnas] of Object.entries(REQUERIDO)) {
        const cols = externa.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name);
        if (!cols.length) {
          faltan.push(`falta la tabla «${tabla}»`);
          continue;
        }
        const ausentes = columnas.filter((c) => !cols.includes(c));
        if (ausentes.length) faltan.push(`a «${tabla}» le faltan las columnas: ${ausentes.join(", ")}`);
      }
      if (faltan.length) {
        const e = new Error("esquema_incompatible");
        e.detalle = faltan;
        throw e;
      }
      return { externa, tmp };
    } catch (err) {
      if (externa) {
        try { externa.close(); } catch { /* ya cerrada */ }
      }
      fs.rmSync(tmp, { force: true });
      if (err.message === "esquema_incompatible") throw err;
      const e = new Error("sqlite_ilegible");
      e.detalle = err.message;
      throw e;
    }
  }

  /** Lee el .sqlite ajeno y lo pasa al formato semilla, sin overrides. */
  function datasetDeSqlite(externa) {
    const d = buildDataset(externa, {});
    return { types: d.types, pokemon: d.pokemon, moves: d.moves, abilities: d.abilities, type_chart: d.type_chart };
  }

  function conSqlite(req, res, fn) {
    let abierto = null;
    try {
      abierto = abrirSubido(req.body);
      return fn(datasetDeSqlite(abierto.externa));
    } catch (err) {
      const codigo = err.message === "esquema_incompatible" || err.message === "no_es_sqlite" ? 400 : 500;
      return res.status(codigo).json({ error: err.message, detalle: err.detalle, valid: false });
    } finally {
      if (abierto) {
        try { abierto.externa.close(); } catch { /* ya cerrada */ }
        fs.rmSync(abierto.tmp, { force: true });
      }
    }
  }

  // POST /api/import/sqlite/preview
  router.post("/sqlite/preview", crudo, (req, res) => {
    const ctx = contexto(req);
    if (ctx.error) return res.status(ctx.error === "sesion_no_encontrada" ? 404 : 400).json({ error: ctx.error });

    conSqlite(req, res, (dataset) => {
      const r = analizar(dataset, ctx);
      res.json({
        valid: r.valid, errors: r.errors, warnings: r.warnings,
        summary: r.summary, examples: r.examples,
        target: ctx.target, session: ctx.name,
      });
    });
  });

  // POST /api/import/sqlite/apply?mode=merge|replace
  router.post("/sqlite/apply", crudo, (req, res) => {
    const ctx = contexto(req);
    if (ctx.error) return res.status(ctx.error === "sesion_no_encontrada" ? 404 : 400).json({ error: ctx.error });
    const mode = req.query.mode === "replace" ? "replace" : "merge";

    conSqlite(req, res, (dataset) => {
      const r = analizar(dataset, ctx);
      if (!r.valid) return res.status(422).json({ error: "validacion_fallida", errors: r.errors });
      try {
        res.json({ ok: true, mode, ...aplicar(dataset, ctx, r, mode) });
      } catch (err) {
        res.status(500).json({ error: "aplicacion_fallida", detalle: err.message });
      }
    });
  });

  /* ------------------------------- aplicación ------------------------------ */

  function aplicar(dataset, ctx, analisis, mode) {
    return ctx.target === "global"
      ? aplicarGlobal(dataset, mode)
      : aplicarSesion(dataset, ctx, mode);
  }

  /**
   * Global: se reconstruyen las tablas de datos. `merge` conserva lo que el
   * fichero no menciona; `replace` deja exactamente el contenido del fichero.
   * Las sesiones, perfiles e historial no se tocan nunca.
   */
  function aplicarGlobal(dataset, mode) {
    const actual = buildDataset(db, {});
    const fusionar = (entity, clave) => {
      const entrantes = dataset[entity];
      if (entrantes === undefined) return mode === "replace" ? [] : actual[entity];
      if (mode === "replace") return entrantes;
      const porClave = new Map(actual[entity].map((r) => [clave(r), r]));
      for (const row of entrantes) porClave.set(clave(row), row);
      return [...porClave.values()];
    };

    const final = {
      types: fusionar("types", KEY_OF.types),
      pokemon: fusionar("pokemon", KEY_OF.pokemon),
      moves: fusionar("moves", KEY_OF.moves),
      abilities: fusionar("abilities", KEY_OF.abilities),
      typeChart: dataset.type_chart !== undefined && (mode === "replace" || dataset.type_chart)
        ? dataset.type_chart
        : actual.type_chart,
    };
    final.pokemon.sort((a, b) => a.dex - b.dex);

    db.transaction(() => {
      // Orden inverso a las claves foráneas.
      for (const t of ["pokemon_abilities", "pokemon_types", "pokemon", "moves", "abilities", "relations", "types", "generations"]) {
        db.prepare(`DELETE FROM ${t}`).run();
      }
      populate(db, final);
    })();

    return {
      target: "global",
      counts: { types: final.types.length, pokemon: final.pokemon.length, moves: final.moves.length, abilities: final.abilities.length },
    };
  }

  /**
   * Sesión: las diferencias contra el dato GLOBAL se guardan como overrides.
   * Se compara contra el global (no contra la sesión) porque `data_json` es un
   * parche sobre el global; si se comparase contra la sesión, lo que ya estaba
   * override y el fichero repite se perdería.
   */
  function aplicarSesion(dataset, ctx, mode) {
    const global = buildDataset(db, {});
    const idx = indices(db);
    const abilityByName = new Map(
      db.prepare("SELECT name_es, name_en, effect_es FROM abilities").all()
        .map((a) => [a.name_es, { ...a, is_hidden: 0 }])
    );

    const previo = mode === "replace" ? {} : { ...ctx.overrides };
    const data = {
      types: { ...(previo.types || {}) },
      pokemon: { ...(previo.pokemon || {}) },
      moves: { ...(previo.moves || {}) },
      abilities: { ...(previo.abilities || {}) },
      relations: { ...(previo.relations || {}) },
    };
    if (previo.theme) data.theme = previo.theme;

    const resultado = {};
    for (const entity of ENTITIES) {
      const rows = dataset[entity];
      if (rows === undefined) continue;

      const porClave = new Map((global[entity] || []).map((r) => [KEY_OF[entity](r), r]));
      let actualizados = 0, omitidos = 0, sinCambios = 0;

      for (const fila of rows) {
        const key = KEY_OF[entity](fila);
        if (key === null) continue;
        const base = porClave.get(key);
        if (!base) {
          omitidos++; // alta: no representable como override
          continue;
        }
        const patch = aOverride(entity, fila, base, abilityByName);
        const id = entity === "types" ? key : idx[entity].get(key);
        if (id === undefined) {
          omitidos++;
          continue;
        }
        if (Object.keys(patch).length) {
          data[entity][String(id)] = { ...(data[entity][String(id)] || {}), ...patch };
          actualizados++;
        } else {
          // Coincide con el global: si había override previo, se retira.
          if (mode === "replace") delete data[entity][String(id)];
          sinCambios++;
        }
      }
      resultado[entity] = { updated: actualizados, skipped: omitidos, unchanged: sinCambios };
    }

    // type_chart -> overrides de relaciones: solo lo que difiera del global.
    if (dataset.type_chart && typeof dataset.type_chart === "object") {
      const base = global.type_chart;
      const rel = mode === "replace" ? {} : data.relations;
      for (const atk of Object.keys(dataset.type_chart)) {
        if (atk.startsWith("_")) continue;
        const fila = dataset.type_chart[atk];
        if (!fila || typeof fila !== "object") continue;
        for (const def of Object.keys(fila)) {
          const nuevo = Number(fila[def]);
          const anterior = (base[atk] && base[atk][def] !== undefined) ? base[atk][def] : 1;
          if (nuevo !== anterior) {
            if (!rel[atk]) rel[atk] = {};
            rel[atk][def] = nuevo;
          }
        }
      }
      data.relations = rel;
    }

    for (const k of Object.keys(data)) {
      if (data[k] && typeof data[k] === "object" && !Object.keys(data[k]).length) delete data[k];
    }

    db.prepare("UPDATE sessions SET data_json = ? WHERE id = ?").run(JSON.stringify(data), ctx.sessionId);
    return { target: "session", session: ctx.name, mode, entities: resultado };
  }

  return router;
};
