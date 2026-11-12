"use strict";

/**
 * PamuDeX — Fase 9
 * Datos «extra» de una ficha: movimientos que aprende, línea evolutiva y formas.
 *
 *   GET /api/extra/pokemon/:id   { moves, evolutions, forms }
 *   GET /api/extra/move/:id      { pokemon }
 *
 * POR QUÉ NO VAN DENTRO DE `/api/pokemon/:id`
 * -------------------------------------------
 * Los tres middlewares (generación, sesión y Champions) interceptan todo lo que
 * cuelga de `/api/pokemon`, `/api/moves`, `/api/abilities` y `/api/types`, y
 * tratan cualquier respuesta con ruta de más de un segmento como UNA FICHA: un
 * `/api/pokemon/25/moves` que devolviera una lista saldría convertido en `{}`
 * por el de sesiones. Fuera de esos prefijos no los toca ninguno.
 *
 * Y POR QUÉ DEVUELVE IDS Y NO NOMBRES
 * -----------------------------------
 * Por lo mismo, aquí no se aplican overrides ni el filtro de Champions. Así que
 * la respuesta lleva solo ids, y el frontend los cruza con `api.moves.list()` y
 * `api.pokemon.list()`, que SÍ pasan por los middlewares y además ya están en
 * la caché local: un movimiento renombrado en el ROM Hack sale con su nombre
 * nuevo y uno no permitido en Champions no sale, sin que esta ruta sepa nada de
 * modos. El método de evolución y el nombre de una forma sí van como texto: no
 * hay overrides para ellos.
 */

const express = require("express");
const { parseId } = require("../lib/scope");

module.exports = (db) => {
  const router = express.Router();

  const q = {
    pokemon: db.prepare("SELECT id FROM pokemon WHERE id = ?"),
    moves: db.prepare(
      `SELECT move_id, method, level FROM pokemon_moves WHERE pokemon_id = ?
        ORDER BY method, level, move_id`
    ),
    learners: db.prepare(
      `SELECT pokemon_id, method, level FROM pokemon_moves WHERE move_id = ?
        ORDER BY pokemon_id, method`
    ),
    parent: db.prepare("SELECT from_pokemon_id AS id FROM evolutions WHERE to_pokemon_id = ?"),
    children: db.prepare(
      `SELECT from_pokemon_id, to_pokemon_id, method_es, method_en
         FROM evolutions WHERE from_pokemon_id = ? ORDER BY to_pokemon_id`
    ),
    forms: db.prepare(
      `SELECT id, form_key, sprite_id, kind, name_es, name_en, types_json,
              hp, atk, def, spa, spd, spe, height_m, weight_kg
         FROM pokemon_forms WHERE pokemon_id = ? ORDER BY id`
    ),
  };

  /**
   * La familia entera: se sube hasta la raíz y se baja por todas las ramas.
   * Con tope de pasos por si un dataset importado dejase un ciclo.
   */
  function familia(pokemonId) {
    let raiz = pokemonId;
    for (let i = 0; i < 10; i++) {
      const padre = q.parent.get(raiz);
      if (!padre || padre.id === pokemonId) break;
      raiz = padre.id;
    }
    const aristas = [];
    const vistos = new Set([raiz]);
    const cola = [raiz];
    while (cola.length && aristas.length < 60) {
      for (const e of q.children.all(cola.shift())) {
        aristas.push({ from: e.from_pokemon_id, to: e.to_pokemon_id, method_es: e.method_es, method_en: e.method_en });
        if (!vistos.has(e.to_pokemon_id)) {
          vistos.add(e.to_pokemon_id);
          cola.push(e.to_pokemon_id);
        }
      }
    }
    return { root: raiz, edges: aristas };
  }

  router.get("/pokemon/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!id || !q.pokemon.get(id)) return res.status(404).json({ error: "Pokémon no encontrado" });

    res.json({
      pokemon_id: id,
      moves: q.moves.all(id),
      evolutions: familia(id),
      forms: q.forms.all(id).map(({ types_json, hp, atk, def, spa, spd, spe, ...resto }) => {
        let types = [];
        try {
          types = JSON.parse(types_json);
        } catch (err) {
          types = [];
        }
        return { ...resto, types, stats: { hp, atk, def, spa, spd, spe } };
      }),
    });
  });

  router.get("/move/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ error: "Movimiento no encontrado" });
    res.json({ move_id: id, pokemon: q.learners.all(id) });
  });

  return router;
};
