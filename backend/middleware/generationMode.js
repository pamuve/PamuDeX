"use strict";

/**
 * PamuDeX — Tarea 7.1
 * Middleware del modo por generación.
 *
 * QUÉ HACE
 * --------
 *  1. Añade `has_generational_differences` a TODA ficha de Pokémon, movimiento,
 *     habilidad o tipo. Es lo que decide si el frontend enseña el selector de
 *     generación: sin cambios registrados no se enseña, para no meter un
 *     desplegable inútil en 1.025 fichas.
 *  2. Con `?gen=<n>`, reescribe los campos que en esa generación valían otra
 *     cosa (ver `lib/generations.js` para el modelo de datos).
 *
 * POR QUÉ UN MIDDLEWARE Y NO CUATRO RUTAS
 * ---------------------------------------
 * El encargo 07-01 pedía tocar `pokemon.js`, `moves.js`, `abilities.js` y
 * `types.js` una a una. Es el mismo problema que resolvieron `sessionOverrides`
 * en la Fase 3 y `championsMode` en la 6.3: interceptando `res.json` no hay que
 * modificar ni una línea de las rutas de datos, y cuando la 7.2 y la 7.3 añadan
 * más cosas hay un solo sitio que tocar en vez de cuatro.
 *
 * ESTE SÍ ACTÚA SIN SU PARÁMETRO — ES LA DIFERENCIA CON LOS OTROS DOS
 * -------------------------------------------------------------------
 * `sessionOverrides` y `championsMode` hacen `next()` y desaparecen si no ven su
 * query. Este no puede: `has_generational_differences` tiene que ir en la ficha
 * SIEMPRE, porque el frontend lo necesita justo cuando el usuario todavía no ha
 * elegido generación. El coste es un COUNT por índice en cada petición de
 * detalle, y en los listados y el resto de rutas no se hace nada.
 *
 * DÓNDE SE MONTA: DESPUÉS DE `sessionOverrides`
 * ---------------------------------------------
 * Los wrappers de `res.json` se aplican en orden INVERSO al de montaje (el
 * último en envolver es el primero en transformar). Montándolo el último, el
 * orden real de transformación es: generación -> sesión -> Champions. Es el que
 * se quiere: primero se reconstruye el dato histórico y encima pisan los
 * overrides del ROM Hack, que son una edición explícita del usuario y deben
 * mandar. `?gen=` y `?session=` NO son excluyentes (a diferencia de Champions):
 * mirar la división físico/especial de la Gen 4 estando en Radical Red es una
 * consulta razonable.
 */

const {
  createGenerations,
  parseGeneration,
  ENTITY_BY_PATH,
  CURRENT_GENERATION,
} = require("../lib/generations");
const { TYPE_IDS, buildChart, defensiveMultiplier } = require("../lib/typechart");
const { loadTypesMeta, rebuildGroups } = require("../lib/buckets");
const { isPlainObject } = require("../lib/overrides");

/** Solo las fichas: `/pokemon/25`, `/types/acero`… nunca los listados. */
const DETAIL_PATH = /^\/(pokemon|moves|abilities|types)\/(.+)$/;

/** Grupos de efectividad que puede traer una respuesta. */
const BUCKET_FIELDS = ["efectividad", "ofensivo", "defensivo"];

/**
 * Escribe un campo en el cuerpo. Admite un nivel de anidamiento con punto
 * (`stats.atk`), que es hasta donde llegan los overrides de la Fase 3 y hasta
 * donde tiene sentido llegar aquí.
 */
function setField(body, field, value) {
  const dot = field.indexOf(".");
  if (dot === -1) {
    if (!(field in body)) return false;
    body[field] = value;
    return true;
  }
  const parent = field.slice(0, dot);
  const child = field.slice(dot + 1);
  if (!isPlainObject(body[parent]) || !(child in body[parent])) return false;
  body[parent] = { ...body[parent], [child]: value };
  return true;
}

module.exports = (db) => {
  const generations = createGenerations(db);

  // Los metadatos de tipos se cargan una vez por proceso: la tabla `types` no
  // cambia en caliente (los renombres de sesión los aplica el otro middleware).
  let typesMeta = null;
  const getTypesMeta = () => (typesMeta || (typesMeta = loadTypesMeta(db)));

  return function generationMode(req, res, next) {
    const match = (req.path.replace(/\/+$/, "") || "/").match(DETAIL_PATH);
    if (!match) return next();

    const entityType = ENTITY_BY_PATH[match[1]];
    const gen = parseGeneration(req.query && req.query.gen);
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      try {
        return originalJson(transform(body));
      } catch (err) {
        // Ante cualquier imprevisto, mejor el dato actual que una ficha rota.
        return originalJson(body);
      }
    };

    next();

    /* -------------------------------------------------------------- */

    function transform(body) {
      if (!isPlainObject(body)) return body;
      // Una ficha que no existe (404) o que Champions ha rechazado no lleva id.
      if (body.id === undefined || body.error !== undefined) return body;

      // El id de la RESPUESTA, no el de la URL: `/api/pokemon/:id` acepta
      // también el nº de Pokédex, y `entity_changes` se indexa por id interno,
      // igual que los favoritos y el historial.
      const ref = body.id;
      const tieneCambios = generations.hasGenerationalDifferences(entityType, ref);
      const salida = {
        ...body,
        has_generational_differences: tieneCambios,
        // Tarea 7.2 — la lista viaja EMBEBIDA en la ficha, no en un endpoint
        // aparte. Son dos razones: `/api/history` ya es el historial de
        // consultas por perfil (Tarea 5.4) y no puede significar además esto, y
        // así las etiquetas de cambios funcionan sin conexión con la misma
        // respuesta que el Service Worker ya tiene cacheada.
        //
        // Va también cuando se pide una generación concreta: es barato (solo hay
        // filas en las pocas entidades que cambiaron) y la 7.3 lo reutiliza.
        generational_changes: tieneCambios ? generations.changesFor(entityType, ref) : [],
      };

      // Sin `?gen`, o pidiendo la generación actual, la ficha es la de hoy.
      if (gen === null || gen >= CURRENT_GENERATION) return salida;

      const valores = generations.getValueAtGeneration(entityType, ref, gen);
      const chartOverrides = generations.chartOverridesAt(gen);
      if (!Object.keys(valores).length && !chartOverrides) return salida;

      if (entityType === "pokemon") return atGenPokemon(salida, valores, chartOverrides);
      if (entityType === "type") return atGenType(salida, valores, chartOverrides);
      if (entityType === "move") return atGenMove(salida, valores);
      return applyPlainFields(salida, valores);
    }

    /** Campos sueltos, sin nada que rehidratar ni recalcular. */
    function applyPlainFields(body, valores, skip) {
      for (const [field, value] of Object.entries(valores)) {
        if (skip && skip.has(field)) continue;
        // Las relaciones de la tabla de tipos no son campos de la ficha.
        if (field.startsWith("relation:")) continue;
        setField(body, field, value);
      }
      return body;
    }

    /**
     * El historial guarda los tipos como ids (`["normal"]`), pero la ficha los
     * devuelve como objetos con nombre y color. Se rehidratan para que el
     * frontend siga pintando los TypeBadge igual.
     */
    function hydrateTypes(ids) {
      const meta = getTypesMeta();
      return ids
        .map((raw) => String(raw).toLowerCase())
        .filter((id) => TYPE_IDS.includes(id))
        .map((id) => meta.get(id) || { id, name_es: id, name_en: id, color: "#888888" });
    }

    function atGenPokemon(body, valores, chartOverrides) {
      const cambioTipos = Array.isArray(valores.types);
      applyPlainFields(body, valores, new Set(["types"]));

      if (cambioTipos) {
        const hidratados = hydrateTypes(valores.types);
        if (hidratados.length) body.types = hidratados;
      }

      // La efectividad se recalcula si cambiaron los tipos del Pokémon O si
      // cambió la tabla de tipos: en la Gen 5 nadie era débil a Hada, aunque el
      // Pokémon tuviera exactamente los mismos tipos que hoy.
      if ((cambioTipos || chartOverrides) && Array.isArray(body.efectividad)) {
        const ids = (body.types || [])
          .map((t) => String(isPlainObject(t) ? t.id : t).toLowerCase())
          .filter((id) => TYPE_IDS.includes(id));
        if (ids.length) {
          const chart = buildChart(db, chartOverrides);
          const multiplicadores = {};
          for (const atacante of TYPE_IDS) {
            multiplicadores[atacante] = defensiveMultiplier(chart, atacante, ids);
          }
          body.efectividad = rebuildGroups(
            body.efectividad,
            multiplicadores,
            getTypesMeta(),
            null
          );
        }
      }
      return body;
    }

    function atGenType(body, valores, chartOverrides) {
      applyPlainFields(body, valores);
      if (!chartOverrides) return body;

      const typeId = String(body.id || "").toLowerCase();
      if (!TYPE_IDS.includes(typeId)) return body;

      const meta = getTypesMeta();
      const chart = buildChart(db, chartOverrides);

      if (Array.isArray(body.ofensivo)) {
        const ofensivo = {};
        for (const def of TYPE_IDS) ofensivo[def] = chart[typeId][def];
        body.ofensivo = rebuildGroups(body.ofensivo, ofensivo, meta, null);
      }
      if (Array.isArray(body.defensivo)) {
        const defensivo = {};
        for (const atk of TYPE_IDS) defensivo[atk] = chart[atk][typeId];
        body.defensivo = rebuildGroups(body.defensivo, defensivo, meta, null);
      }
      return body;
    }

    /**
     * La ficha de movimiento trae el tipo desnormalizado (`color`,
     * `type_name_es`, `type_name_en`) del JOIN con `types`. Si el movimiento era
     * de otro tipo en esa generación hay que mover los tres, o la insignia
     * saldría con el nombre viejo y el color nuevo.
     */
    function atGenMove(body, valores) {
      applyPlainFields(body, valores);
      if (valores.type_id === undefined) return body;

      const meta = getTypesMeta().get(String(valores.type_id).toLowerCase());
      if (!meta) return body;

      if ("color" in body) body.color = meta.color;
      if ("type_name_es" in body) body.type_name_es = meta.name_es;
      if ("type_name_en" in body) body.type_name_en = meta.name_en;
      return body;
    }
  };
};
