"use strict";

/**
 * PamuDeX — Tarea 6.0
 * Objetos del dataset.
 *
 * Tabla (backend/db/schema.sql): items(id, name_es, name_en, category, effect_es)
 *
 * POR QUÉ HAY FILTROS AQUÍ Y NO EN LOS DEMÁS LISTADOS
 * ---------------------------------------------------
 * `/api/pokemon`, `/api/moves` y `/api/abilities` devuelven la lista entera sin
 * parámetros: son 1025, 901 y 312 entradas. Los objetos son **2151**, y el
 * editor de reglas de Champions (6.1) necesita enseñarlos por categorías para
 * que marcarlos sea manejable. Filtrar en SQLite es más barato que mandar 400 KB
 * y que el cliente los descarte.
 *
 * `?q=` busca por nombre en los dos idiomas. Sin parámetros, el comportamiento
 * es el de siempre: la lista completa.
 *
 * NO HAY DATO DE «EQUIPABLE». PokeAPI no lo sabe: el Chaleco Asalto y el Casco
 * Dentado llegan sin atributos y en cambio la Poción trae `holdable`. Se dejó
 * fuera antes que inventárselo (ver tools/fetch-dataset.js). Para separar
 * objetos de combate del resto, la vía es `category`.
 *
 * ESTA RUTA NO PASA POR LOS OVERRIDES DE SESIÓN. El middleware de la Fase 3
 * solo cubre types/pokemon/moves/abilities y /search, así que un ROM Hack
 * todavía no puede reescribir objetos. Queda anotado como pendiente.
 *
 * Convención del proyecto: el módulo exporta (db) => router y se monta en server.js.
 */

const express = require("express");

const MAX_Q = 60;

module.exports = (db) => {
  const router = express.Router();

  const q = {
    // El listado no trae `effect_es`: son 2151 filas y el texto es la mayor
    // parte del peso. La descripción se pide en la ficha.
    list: db.prepare(
      `SELECT id, name_es, name_en, category
         FROM items
        ORDER BY name_es`
    ),
    byCategory: db.prepare(
      `SELECT id, name_es, name_en, category
         FROM items
        WHERE category = ?
        ORDER BY name_es`
    ),
    search: db.prepare(
      `SELECT id, name_es, name_en, category
         FROM items
        WHERE name_es LIKE ? OR name_en LIKE ?
        ORDER BY name_es`
    ),
    byId: db.prepare(`SELECT * FROM items WHERE id = ?`),
    categories: db.prepare(
      `SELECT category, COUNT(*) AS total
         FROM items
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY category`
    ),
  };

  // GET /api/items[?category=held-items][&q=resto]
  router.get("/", (req, res) => {
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const texto = typeof req.query.q === "string" ? req.query.q.trim().slice(0, MAX_Q) : "";

    let rows;
    if (texto) {
      const patron = `%${texto}%`;
      rows = q.search.all(patron, patron);
      if (category) rows = rows.filter((row) => row.category === category);
    } else if (category) {
      rows = q.byCategory.all(category);
    } else {
      rows = q.list.all();
    }

    res.json(rows);
  });

  // GET /api/items/categories -> categorías con su recuento, para el editor de
  // reglas. Va ANTES de /:id para que "categories" no se lea como un id.
  router.get("/categories", (req, res) => {
    res.json(q.categories.all());
  });

  // GET /api/items/:id
  router.get("/:id", (req, res) => {
    const item = q.byId.get(req.params.id);
    if (!item) return res.status(404).json({ error: "Objeto no encontrado" });
    res.json(item);
  });

  return router;
};
