"use strict";

/**
 * PamuDeX — motor de efectividad de tipos.
 * Fase 1, reescrito como factoría en la Tarea 6.2.
 *
 * QUÉ CAMBIÓ EN LA 6.2 Y POR QUÉ
 * ------------------------------
 * Antes este módulo agrupaba **por valor numérico** y deducía la etiqueta de
 * ahí (`LABELS[4] -> hiper_eficaz`). Eso impedía que el modo Champions
 * redefiniera los valores: poner «hiper eficaz» a x3 hacía que el resultado
 * cayera en el cubo de x2, porque 3 está más cerca de 2 que de 4.
 *
 * Ahora el recorrido va al revés, **clave -> valor**:
 *   1. el producto de la tabla de tipos (4, 2, 1, 0.5, 0.25, 0) decide la
 *      CATEGORÍA — eso no lo puede cambiar nadie, sale del cruce de tipos;
 *   2. el conjunto de reglas decide QUÉ NÚMERO se enseña para esa categoría.
 *
 * LAS CLAVES SON CANÓNICAS, LOS VALORES NO
 * ----------------------------------------
 * `hiper_eficaz`, `super_eficaz`, `normal`, `poco_eficaz`, `muy_poco_eficaz` y
 * `sin_efecto` son valores canónicos del proyecto: `frontend/src/lib/damage.ts`,
 * `types.ts` y `EffectivenessPanel.tsx` comparan contra ellas. Un conjunto de
 * reglas puede decir que «hiper eficaz» vale x3; no puede renombrar la
 * categoría ni inventarse una nueva.
 *
 * TAMBIÉN SE DEJÓ DE ABRIR UNA SEGUNDA CONEXIÓN A SQLITE
 * ------------------------------------------------------
 * El módulo hacía `new Database(DB_PATH, { readonly: true })` al importarse, en
 * vez de recibir `db` como todo el resto del backend, y preparaba la consulta de
 * relaciones en CADA cruce de tipos (18 por ficha). Ahora recibe la conexión y
 * prepara una sola vez.
 */

/**
 * Categorías, en el orden en que se pintan (de más a menos eficaz).
 * `value` es el producto de la tabla de tipos que corresponde a cada una y el
 * valor por defecto que se enseña cuando no hay personalización.
 */
const CATEGORIES = [
  { key: "hiper_eficaz", es: "HIPER EFICAZ", value: 4 },
  { key: "super_eficaz", es: "SUPEREFICAZ", value: 2 },
  { key: "normal", es: "NORMAL", value: 1 },
  { key: "poco_eficaz", es: "POCO EFICAZ", value: 0.5 },
  { key: "muy_poco_eficaz", es: "MUY POCO EFICAZ", value: 0.25 },
  { key: "sin_efecto", es: "SIN EFECTO", value: 0 },
];

const KEYS = CATEGORIES.map((c) => c.key);

const DEFAULT_MULTIPLIERS = CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c.value;
  return acc;
}, {});

/** Tope de un multiplicador personalizado. Por encima el panel no se lee. */
const MAX_MULTIPLIER = 99;

/**
 * Categoría a la que pertenece un producto de la tabla de tipos.
 * Se queda con la más cercana para evitar sorpresas con los floats
 * (0.5 * 0.5 no siempre da exactamente 0.25 en coma flotante).
 */
function categoryOf(product) {
  let best = CATEGORIES[0];
  for (const category of CATEGORIES) {
    if (Math.abs(product - category.value) < Math.abs(product - best.value)) best = category;
  }
  return best;
}

/**
 * Valida una tabla de multiplicadores que llega de fuera.
 * Devuelve `{ ok: true, multipliers }` (ya completada con los valores por
 * defecto que falten) o `{ ok: false, error, key }`.
 *
 * `null` significa «sin personalizar» y devuelve null, no los valores por
 * defecto: así la base guarda NULL y se distingue de haberlos puesto a mano.
 */
function normalizeMultipliers(raw) {
  if (raw === null || raw === undefined) return { ok: true, multipliers: null };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "multiplicadores_invalidos" };

  const multipliers = {};
  for (const key of Object.keys(raw)) {
    if (!KEYS.includes(key)) return { ok: false, error: "clave_invalida", key };
    const value = Number(raw[key]);
    if (!Number.isFinite(value) || value < 0 || value > MAX_MULTIPLIER) {
      return { ok: false, error: "valor_invalido", key };
    }
    multipliers[key] = value;
  }
  if (!Object.keys(multipliers).length) return { ok: true, multipliers: null };

  // Se guarda la tabla completa: si mañana cambian los valores por defecto del
  // proyecto, un conjunto de reglas existente no debe moverse solo.
  return { ok: true, multipliers: { ...DEFAULT_MULTIPLIERS, ...multipliers } };
}

/** ¿Esta tabla se aparta de los valores por defecto? */
function isCustomized(multipliers) {
  if (!multipliers) return false;
  return KEYS.some((key) => Number(multipliers[key]) !== DEFAULT_MULTIPLIERS[key]);
}

/**
 * Crea el motor sobre una conexión concreta.
 *
 * @param db           conexión better-sqlite3
 * @param multipliers  tabla propia del modo, o null para los valores de siempre
 */
function createEffectiveness(db, multipliers) {
  const efectivos = { ...DEFAULT_MULTIPLIERS, ...(multipliers || {}) };

  const ALL_TYPES = db.prepare("SELECT id FROM types").all().map((r) => r.id);

  // Preparada UNA vez, no una por cruce de tipos.
  const relacion = db.prepare(
    "SELECT multiplier FROM relations WHERE attacker_type = ? AND defender_type = ?"
  );

  function getMultiplier(attackerType, defenderType) {
    const row = relacion.get(attackerType, defenderType);
    return row ? row.multiplier : 1;
  }

  /**
   * Pasa un mapa `clave de categoría -> tipos` a la forma que devuelve la API.
   * El orden es el de CATEGORIES, no el del número: así el panel no se
   * reordena solo porque alguien ponga «hiper eficaz» por debajo de x2.
   */
  function toBuckets(porCategoria) {
    return CATEGORIES.filter((c) => porCategoria[c.key] && porCategoria[c.key].length).map((c) => ({
      multiplier: efectivos[c.key],
      label: c.es,
      key: c.key,
      types: porCategoria[c.key],
    }));
  }

  /** Efectividad DEFENSIVA de un Pokémon (puede tener dos tipos). */
  function defensiveProfile(defenderTypes) {
    const porCategoria = {};
    for (const attackerType of ALL_TYPES) {
      let total = 1;
      for (const dt of defenderTypes) total *= getMultiplier(attackerType, dt);
      const { key } = categoryOf(total);
      (porCategoria[key] = porCategoria[key] || []).push(attackerType);
    }
    return toBuckets(porCategoria);
  }

  /** Efectividad OFENSIVA de un tipo de ataque contra todos los demás. */
  function offensiveProfile(attackerType) {
    const porCategoria = {};
    for (const defenderType of ALL_TYPES) {
      const { key } = categoryOf(getMultiplier(attackerType, defenderType));
      (porCategoria[key] = porCategoria[key] || []).push(defenderType);
    }
    return toBuckets(porCategoria);
  }

  /** Efectividad defensiva de un solo tipo — panel «Defensivo» de la ficha. */
  function defensiveProfileForSingleType(defenderType) {
    return defensiveProfile([defenderType]);
  }

  return {
    defensiveProfile,
    offensiveProfile,
    defensiveProfileForSingleType,
    ALL_TYPES,
    multipliers: efectivos,
  };
}

module.exports = {
  createEffectiveness,
  CATEGORIES,
  KEYS,
  DEFAULT_MULTIPLIERS,
  MAX_MULTIPLIER,
  categoryOf,
  normalizeMultipliers,
  isCustomized,
};
