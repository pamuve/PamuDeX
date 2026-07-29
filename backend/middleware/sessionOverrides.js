"use strict";

/**
 * PamuDeX — Tarea 3.2
 * Middleware de overrides por sesión.
 *
 * POR QUÉ UN MIDDLEWARE Y NO UN CAMBIO EN CADA RUTA
 * -------------------------------------------------
 * El encargo original pedía tocar types.js / pokemon.js / moves.js / abilities.js /
 * search.js uno a uno. Este middleware hace lo mismo interceptando `res.json`
 * justo antes de responder, sin modificar ni una línea de esas rutas. Ventajas:
 * menos superficie de error, y las rutas de la Fase 1 siguen intactas.
 *
 * Se monta ANTES de las rutas:
 *     app.use("/api", sessionOverrides(db));
 *
 * Sin `?session=<id>` en la query no hace absolutamente nada: `next()` y fuera.
 * El comportamiento actual de la API no cambia.
 */

const {
  isPlainObject,
  applyOverrides,
  getSessionOverrides,
  overrideFor,
  applyToList,
} = require("../lib/overrides");

const { TYPE_IDS, buildChart, defensiveMultiplier } = require("../lib/typechart");

/** Etiquetas por defecto, por si la respuesta original no trae ese multiplicador. */
const DEFAULT_LABELS = {
  4: { label: "HIPER EFICAZ", key: "hiper_eficaz" },
  2: { label: "SUPEREFICAZ", key: "supereficaz" },
  1: { label: "NORMAL", key: "normal" },
  0.5: { label: "POCO EFICAZ", key: "poco_eficaz" },
  0.25: { label: "MUY POCO EFICAZ", key: "muy_poco_eficaz" },
  0: { label: "SIN EFECTO", key: "sin_efecto" },
};

/* ------------------------------------------------------------------ */
/* Metadatos de tipos                                                  */
/* ------------------------------------------------------------------ */

function loadTypesMeta(db) {
  try {
    const rows = db.prepare("SELECT id, name_es, name_en FROM types").all();
    const byId = new Map();
    for (const row of rows) byId.set(String(row.id), row);
    return byId;
  } catch (err) {
    return new Map();
  }
}

/** Saca los ids de tipo de cualquier forma razonable que traiga la respuesta. */
function extractTypeIds(value, typesMeta) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  const ids = [];

  for (const item of list) {
    if (typeof item === "string") {
      const lower = item.toLowerCase();
      if (TYPE_IDS.includes(lower)) {
        ids.push(lower);
        continue;
      }
      for (const [id, meta] of typesMeta) {
        if (meta.name_es === item || meta.name_en === item) {
          ids.push(id);
          break;
        }
      }
    } else if (isPlainObject(item)) {
      const candidate = item.id || item.type_id || item.tipo;
      if (candidate && TYPE_IDS.includes(String(candidate).toLowerCase())) {
        ids.push(String(candidate).toLowerCase());
      }
    }
  }
  return ids;
}

/**
 * El override guarda los tipos como ids (["electrico","hada"]), pero la respuesta
 * original puede traerlos como objetos con color y nombre. Aquí se rehidratan
 * para que el frontend siga pintando los TypeBadge igual que antes.
 */
function hydrateTypes(newIds, originalValue, typesMeta, typesOverride) {
  const sample = Array.isArray(originalValue) ? originalValue[0] : null;
  if (!isPlainObject(sample)) return newIds;

  return newIds.map((id) => {
    const meta = typesMeta.get(id) || { id, name_es: id, name_en: id };
    const previous = (Array.isArray(originalValue) ? originalValue : []).find(
      (t) => isPlainObject(t) && String(t.id).toLowerCase() === id
    );
    const merged = { ...sample, ...meta, ...(previous || {}), id };
    const typeOverride = typesOverride ? typesOverride[id] : null;
    return isPlainObject(typeOverride) ? applyOverrides(merged, typeOverride) : merged;
  });
}

/* ------------------------------------------------------------------ */
/* Reconstrucción de los grupos de efectividad                         */
/* ------------------------------------------------------------------ */

/** Detecta si los tipos de los grupos vienen como id, name_es o name_en. */
function detectRepresentation(groups, typesMeta) {
  const samples = [];
  for (const group of groups || []) {
    if (isPlainObject(group) && Array.isArray(group.types)) samples.push(...group.types);
  }
  const first = samples.find((s) => typeof s === "string");
  if (!first) return "id";
  if (TYPE_IDS.includes(first.toLowerCase())) return "id";
  for (const meta of typesMeta.values()) {
    if (meta.name_es === first) return "name_es";
    if (meta.name_en === first) return "name_en";
  }
  return "id";
}

function renderType(id, representation, typesMeta, typesOverride) {
  if (representation === "id") return id;
  const meta = typesMeta.get(id) || {};
  const override = typesOverride && typesOverride[id];
  if (isPlainObject(override) && override[representation]) return override[representation];
  return meta[representation] || id;
}

/**
 * Rehace los grupos { multiplier, label, key, types[] } a partir de un mapa
 * tipo -> multiplicador, conservando etiquetas, claves, orden y criterio de
 * "grupos vacíos" de la respuesta original.
 */
function rebuildGroups(originalGroups, multipliers, typesMeta, typesOverride) {
  const groups = Array.isArray(originalGroups) ? originalGroups : [];
  const representation = detectRepresentation(groups, typesMeta);
  const hadEmptyGroups = groups.some(
    (g) => isPlainObject(g) && Array.isArray(g.types) && g.types.length === 0
  );

  const meta = new Map();
  for (const group of groups) {
    if (!isPlainObject(group)) continue;
    const mult = Number(group.multiplier);
    if (Number.isNaN(mult)) continue;
    meta.set(mult, { label: group.label, key: group.key });
  }

  const byMultiplier = new Map();
  for (const [typeId, mult] of Object.entries(multipliers)) {
    if (!byMultiplier.has(mult)) byMultiplier.set(mult, []);
    byMultiplier.get(mult).push(renderType(typeId, representation, typesMeta, typesOverride));
  }

  const allMultipliers = new Set([...meta.keys(), ...byMultiplier.keys()]);
  const ordered = [...allMultipliers].sort((a, b) => b - a);

  const result = ordered.map((mult) => {
    const known = meta.get(mult) || DEFAULT_LABELS[mult] || { label: `x${mult}`, key: `x${mult}` };
    return {
      multiplier: mult,
      label: known.label,
      key: known.key,
      types: byMultiplier.get(mult) || [],
    };
  });

  return hadEmptyGroups ? result : result.filter((g) => g.types.length > 0);
}

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

module.exports = (db) => {
  return function sessionOverrides(req, res, next) {
    const sessionId = req.query && req.query.session;
    if (!sessionId) return next();

    const overrides = getSessionOverrides(db, sessionId);
    if (!Object.keys(overrides).length) return next();

    const typesOverride = isPlainObject(overrides.types) ? overrides.types : null;
    const hasRelationOverride =
      isPlainObject(overrides.relations) && Object.keys(overrides.relations).length > 0;

    // Se construyen bajo demanda: si la petición no los necesita, no se tocan.
    let typesMeta = null;
    let chart = null;
    const getTypesMeta = () => (typesMeta || (typesMeta = loadTypesMeta(db)));
    const getChart = () => (chart || (chart = buildChart(db, overrides.relations)));

    const path = req.path.replace(/\/+$/, "") || "/";
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      try {
        return originalJson(transform(path, body));
      } catch (err) {
        // Ante cualquier imprevisto, mejor devolver el dato global que romper.
        return originalJson(body);
      }
    };

    next();

    /* -------------------------------------------------------------- */

    function transform(currentPath, body) {
      if (!body || typeof body !== "object") return body;

      // /search
      if (currentPath.startsWith("/search")) {
        return {
          ...body,
          pokemon: applyToList(body.pokemon, overrides, "pokemon"),
          types: applyToList(body.types, overrides, "types"),
          moves: applyToList(body.moves, overrides, "moves"),
          abilities: applyToList(body.abilities, overrides, "abilities"),
        };
      }

      const match = currentPath.match(/^\/(types|pokemon|moves|abilities)(?:\/(.+))?$/);
      if (!match) return body;

      const entity = match[1];
      const id = match[2];

      // Listados
      if (!id) return applyToList(body, overrides, entity);

      // Detalle
      const override = overrideFor(overrides, entity, id) || {};
      let result = applyOverrides(body, override);

      if (entity === "pokemon") result = transformPokemon(body, result, override);
      if (entity === "types") result = transformType(result);

      return result;
    }

    function transformPokemon(original, result, override) {
      const meta = getTypesMeta();
      const typesChanged = override.types !== undefined;
      if (!typesChanged && !hasRelationOverride) return result;

      const typeIds = extractTypeIds(result.types, meta);
      if (!typeIds.length) return result;

      if (typesChanged) {
        result.types = hydrateTypes(typeIds, original.types, meta, typesOverride);
      }

      if (Array.isArray(original.efectividad)) {
        const c = getChart();
        const multipliers = {};
        for (const attacker of TYPE_IDS) {
          multipliers[attacker] = defensiveMultiplier(c, attacker, typeIds);
        }
        result.efectividad = rebuildGroups(original.efectividad, multipliers, meta, typesOverride);
      }
      return result;
    }

    function transformType(result) {
      if (!hasRelationOverride) return result;

      const typeId = String(result.id || "").toLowerCase();
      if (!TYPE_IDS.includes(typeId)) return result;

      const meta = getTypesMeta();
      const c = getChart();

      if (Array.isArray(result.ofensivo)) {
        const offense = {};
        for (const def of TYPE_IDS) offense[def] = c[typeId][def];
        result.ofensivo = rebuildGroups(result.ofensivo, offense, meta, typesOverride);
      }
      if (Array.isArray(result.defensivo)) {
        const defense = {};
        for (const atk of TYPE_IDS) defense[atk] = c[atk][typeId];
        result.defensivo = rebuildGroups(result.defensivo, defense, meta, typesOverride);
      }
      return result;
    }
  };
};
