"use strict";

/**
 * PamuDeX — grupos de efectividad de una respuesta ya emitida.
 * Extraído de `middleware/sessionOverrides.js` en la Tarea 7.1.
 *
 * POR QUÉ EXISTE ESTE MÓDULO
 * --------------------------
 * Los middlewares que interceptan `res.json` no pueden llamar a
 * `lib/effectiveness.js`: ese motor lee la tabla de tipos de la base, y ellos
 * necesitan recalcular con una tabla MODIFICADA (los overrides de la sesión en
 * la Fase 3, las relaciones de otra generación en la 7.1) sobre unos grupos que
 * ya vienen hechos, conservando etiquetas, claves y orden.
 *
 * Estaba escrito dentro de `sessionOverrides.js`; la 7.1 necesitaba lo mismo y
 * la alternativa era una segunda copia de estas sesenta líneas, que es
 * exactamente el problema que la 6.2 resolvió sacando `lib/catalog.js`.
 *
 * NO decide categorías: eso sale del producto de la tabla de tipos y lo hace
 * `lib/effectiveness.js`. Aquí solo se reparten tipos en grupos que ya existen.
 */

const { isPlainObject } = require("./overrides");
const { TYPE_IDS } = require("./typechart");

/** Etiquetas por defecto, por si la respuesta original no trae ese multiplicador. */
const DEFAULT_LABELS = {
  4: { label: "HIPER EFICAZ", key: "hiper_eficaz" },
  // OJO: `super_eficaz` CON guion bajo. Es el valor canónico del proyecto (el
  // que emite lib/effectiveness.js y contra el que comparan lib/damage.ts y
  // EffectivenessPanel.tsx). Aquí ponía `supereficaz` y no se notaba porque
  // estas etiquetas solo se usan cuando la respuesta original no traía ese
  // multiplicador; desde la 6.2 el panel indexa por clave y sí se notaría.
  2: { label: "SUPEREFICAZ", key: "super_eficaz" },
  1: { label: "NORMAL", key: "normal" },
  0.5: { label: "POCO EFICAZ", key: "poco_eficaz" },
  0.25: { label: "MUY POCO EFICAZ", key: "muy_poco_eficaz" },
  0: { label: "SIN EFECTO", key: "sin_efecto" },
};

/**
 * Metadatos de tipos indexados por id. Mapa vacío si la tabla no se puede leer.
 * Incluye `color` porque quien rehidrata un tipo a partir de su id (los dos
 * middlewares) tiene que devolver el objeto completo que pinta `TypeBadge`.
 */
function loadTypesMeta(db) {
  try {
    const rows = db.prepare("SELECT id, name_es, name_en, color FROM types").all();
    const byId = new Map();
    for (const row of rows) byId.set(String(row.id), row);
    return byId;
  } catch (err) {
    return new Map();
  }
}

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
 *
 * `typesOverride` es opcional (null fuera de las sesiones de ROM Hack): sirve
 * para que un tipo renombrado en la sesión salga con su nombre nuevo.
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

module.exports = {
  DEFAULT_LABELS,
  loadTypesMeta,
  detectRepresentation,
  renderType,
  rebuildGroups,
};
