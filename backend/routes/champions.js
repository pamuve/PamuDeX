"use strict";

/**
 * PamuDeX — Tarea 6.1
 * Conjuntos de reglas de Pokémon Champions.
 *
 * Tabla (ya existía en backend/db/schema.sql desde la Fase 1):
 *   champions_rules(id, name, allowed_pokemon_json, allowed_items_json,
 *                   allowed_moves_json, allowed_abilities_json,
 *                   custom_multipliers_json)
 *
 * CHAMPIONS NO ES UNA SESIÓN DE ROM HACK
 * --------------------------------------
 * Aunque compartan el catálogo base, son dos sistemas separados y no se tocan:
 * una sesión REESCRIBE datos del juego (Pikachu pasa a ser Eléctrico/Hada); un
 * conjunto de reglas de Champions solo dice QUÉ CONTENIDO ES LEGAL, sin cambiar
 * ni un dato. Por eso esto no toca `sessions` ni el middleware de overrides, y
 * el modo estándar sigue exactamente igual que antes de esta tarea.
 *
 * LOS CONJUNTOS DE REGLAS SON DEL HOGAR, NO DE CADA PERFIL
 * --------------------------------------------------------
 * `champions_rules` no tiene `profile_id` y se deja así: un formato de combate
 * es algo que se comparte entre quienes juegan en casa. Lo que sí será de cada
 * perfil es CUÁL tiene puesto, y para eso está la tabla `settings` de la 5.4
 * (lo montará la 6.3, que es la que enciende el modo).
 *
 * NULL != []  ->  ver `lib/championsFilter.js`. Resumen: columna NULL es «sin
 * restricción» y `[]` es «nada permitido».
 *
 * Convención del proyecto: el módulo exporta (db) => router y se monta en server.js.
 */

const express = require("express");
const {
  ENTITIES,
  COLUMN,
  parseAllowed,
  serializeAllowed,
  filterList,
  readRules,
  catalog,
} = require("../lib/championsFilter");

const MAX_NAME = 60;

/** Recorta y limita un texto libre. Devuelve "" si no es una cadena. */
function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/** Convierte el :id de la URL en entero positivo, o null si no es válido. */
function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

module.exports = (db) => {
  const router = express.Router();
  const cat = catalog(db);

  const q = {
    list: db.prepare(`SELECT * FROM champions_rules ORDER BY name COLLATE NOCASE ASC`),
    byId: db.prepare(`SELECT * FROM champions_rules WHERE id = ?`),
    // Un conjunto nuevo nace con las cuatro columnas a NULL: permite todo, que
    // es lo único que lo hace usable desde el primer momento.
    insert: db.prepare(`INSERT INTO champions_rules (name) VALUES (?)`),
    rename: db.prepare(`UPDATE champions_rules SET name = ? WHERE id = ?`),
    remove: db.prepare(`DELETE FROM champions_rules WHERE id = ?`),
  };

  /** UPDATE de una columna allowed_*, preparado una vez por entidad. */
  const setAllowed = {};
  for (const entity of ENTITIES) {
    setAllowed[entity] = db.prepare(
      `UPDATE champions_rules SET ${COLUMN[entity]} = ? WHERE id = ?`
    );
  }

  /** Busca el conjunto de reglas del :id, o responde ya con el error. */
  function rulesFrom(req, res) {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "id_invalido" });
      return null;
    }
    const row = q.byId.get(id);
    if (!row) {
      res.status(404).json({ error: "reglas_no_encontradas" });
      return null;
    }
    return row;
  }

  // GET /api/champions -> listado con el recuento de cada entidad, sin los ids.
  // Un conjunto restrictivo puede tener miles de ids y el listado no los usa.
  router.get("/", (req, res) => {
    res.json(
      q.list.all().map((row) => {
        const reglas = readRules(row);
        return { id: reglas.id, name: reglas.name, counts: reglas.counts };
      })
    );
  });

  // GET /api/champions/:id -> conjunto completo, con las listas de ids.
  router.get("/:id", (req, res) => {
    const row = rulesFrom(req, res);
    if (!row) return;
    res.json(readRules(row));
  });

  // POST /api/champions  { name }
  router.post("/", (req, res) => {
    const name = cleanText(req.body && req.body.name, MAX_NAME);
    if (!name) return res.status(400).json({ error: "nombre_requerido" });

    const info = q.insert.run(name);
    res.status(201).json(readRules(q.byId.get(info.lastInsertRowid)));
  });

  // PUT /api/champions/:id  { name?, allowed: { pokemon: [1,2] | null, ... } }
  //
  // Solo se toca lo que venga en el cuerpo. Mandar `null` en una entidad le
  // quita la restricción; mandar `[]` la deja sin nada permitido.
  //
  // `custom_multipliers_json` NO se toca aquí: es de la tarea 6.2. Se conserva
  // tal cual esté en la base.
  router.put("/:id", (req, res) => {
    const row = rulesFrom(req, res);
    if (!row) return;

    const body = req.body || {};

    let name = row.name;
    if (body.name !== undefined) {
      name = cleanText(body.name, MAX_NAME);
      if (!name) return res.status(400).json({ error: "nombre_requerido" });
    }

    // Se valida TODO antes de escribir nada: si una entidad viene mal, el
    // conjunto no se queda a medias.
    const pendientes = [];
    if (body.allowed !== undefined) {
      const allowed = body.allowed;
      if (allowed === null || typeof allowed !== "object" || Array.isArray(allowed)) {
        return res.status(400).json({ error: "allowed_invalido" });
      }
      for (const entity of Object.keys(allowed)) {
        if (!ENTITIES.includes(entity)) {
          return res.status(400).json({ error: "entidad_invalida", entity });
        }
        const resultado = serializeAllowed(allowed[entity]);
        if (!resultado.ok) {
          return res.status(400).json({ error: resultado.error, entity });
        }
        pendientes.push([entity, resultado.json]);
      }
    }

    const guardar = db.transaction(() => {
      if (name !== row.name) q.rename.run(name, row.id);
      for (const [entity, json] of pendientes) setAllowed[entity].run(json, row.id);
    });
    guardar();

    res.json(readRules(q.byId.get(row.id)));
  });

  // DELETE /api/champions/:id
  router.delete("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "id_invalido" });

    const info = q.remove.run(id);
    if (info.changes === 0) return res.status(404).json({ error: "reglas_no_encontradas" });

    res.json({ ok: true, id });
  });

  /* ------------------------------------------------------------------ */
  /* Catálogo filtrado                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * GET /api/champions/:id/pokemon | /moves | /abilities | /items
   *
   * Devuelven EXACTAMENTE la misma forma que `/api/pokemon`, `/api/moves`,
   * `/api/abilities` y `/api/items`, pero solo con lo permitido. Así el
   * frontend puede reutilizar sus tipos y sus componentes sin adaptaciones,
   * que es lo que pide la 6.3.
   *
   * Sin restricción en esa entidad devuelven el catálogo entero.
   */
  for (const entity of ENTITIES) {
    router.get(`/:id/${entity}`, (req, res) => {
      const row = rulesFrom(req, res);
      if (!row) return;
      res.json(filterList(cat[entity](), parseAllowed(row[COLUMN[entity]])));
    });
  }

  return router;
};
