"use strict";

/**
 * PamuDeX — Tarea 7.1
 * Cambios históricos entre generaciones.
 *
 * CÓMO SE LEE UNA FILA DE `entity_changes`
 * ----------------------------------------
 * «En la generación N este campo pasó de `old_value` a `new_value`». La
 * generación es la de ENTRADA EN VIGOR: desde ella vale `new_value`.
 *
 * POR QUÉ SE CAMINA HACIA ATRÁS
 * -----------------------------
 * El dataset sembrado son los valores de HOY, y no hay una copia del catálogo
 * por generación (serían nueve datasets que mantener). Así que el valor de un
 * campo en la generación G es el `old_value` del cambio MÁS ANTIGUO posterior a
 * G: si Puño Fuego pasó de 75 a 100 en la Gen 6, su `old_value` (75) es lo que
 * valía en la 5, en la 4 y en la 3, hasta el cambio anterior si lo hubiera.
 *
 * La consecuencia que hay que tener presente al cargar datos (7.3): una entrada
 * mal fechada desplaza todo lo anterior de ese campo, y no se puede anotar un
 * valor histórico suelto sin encadenarlo con el actual. Cada cambio de un campo
 * debe empalmar con el siguiente (`new_value` de uno = `old_value` del otro), y
 * el último de la cadena debe coincidir con lo que hay en la base.
 *
 * LOS TIPOS SE ANOTAN EN EL DEFENSOR
 * ----------------------------------
 * Un cambio de la tabla de tipos es `field = 'relation:<atacante>'` sobre el
 * tipo DEFENSOR: Acero dejando de resistir a Fantasma en la Gen 6 es
 * `entity_ref='acero'`, `field='relation:fantasma'`. Se eligió el defensor
 * porque es como se recuerda («Acero perdió su resistencia»), pero el cambio
 * afecta igual al perfil ofensivo de Fantasma, así que
 * `hasGenerationalDifferences('type', 'fantasma')` también lo cuenta.
 */

/** Generación del dataset sembrado. Pedir esta o más no reescribe nada. */
const CURRENT_GENERATION = 9;
const MIN_GENERATION = 1;

/** Prefijo de los campos que son relaciones de la tabla de tipos. */
const RELATION_PREFIX = "relation:";

/**
 * Prefijo SINTÉTICO: no existe en la base. `changesFor` lo usa para devolver las
 * relaciones en las que el tipo consultado es el ATACANTE, porque esas filas
 * están anotadas en el defensor. `relation_out:acero` en la ficha de Fantasma se
 * lee «contra Acero».
 */
const RELATION_OUT_PREFIX = "relation_out:";

/** Entidad de la URL -> entidad de `entity_changes` (singular, como favoritos). */
const ENTITY_BY_PATH = {
  pokemon: "pokemon",
  moves: "move",
  abilities: "ability",
  types: "type",
};

/**
 * Los valores van serializados en JSON para que un número vuelva número y un
 * array vuelva array. Se acepta texto plano por si alguien edita la tabla a
 * mano: es preferible devolver la cadena a romper la ficha.
 */
function parseValue(raw) {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return raw;
  }
}

/** Normaliza el `?gen=` de la query. Devuelve null si no es una generación. */
function parseGeneration(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const gen = Number.parseInt(raw, 10);
  if (!Number.isInteger(gen) || gen < MIN_GENERATION || gen > CURRENT_GENERATION) return null;
  return gen;
}

function createGenerations(db) {
  /**
   * La tabla la crea `db/migrate.js` al arrancar, pero el módulo no puede dar
   * por hecho que existe: los tests montan bases mínimas y una instalación
   * puede tener la migración fallada. Si no está, todo responde «sin cambios».
   */
  let q = null;
  try {
    q = {
      countEntity: db.prepare(
        `SELECT COUNT(*) AS c FROM entity_changes WHERE entity_type = ? AND entity_ref = ?`
      ),
      countAsDefender: db.prepare(
        `SELECT COUNT(*) AS c FROM entity_changes WHERE field = ?`
      ),
      changes: db.prepare(
        `SELECT generation, field, old_value, new_value, note
           FROM entity_changes
          WHERE entity_type = ? AND entity_ref = ?
          ORDER BY generation ASC, field ASC`
      ),
      // DESC a propósito: al recorrerlo, cada campo se sobrescribe hasta
      // quedarse con el cambio de generación MÁS BAJA, que es el que trae el
      // `old_value` vigente en la generación pedida.
      before: db.prepare(
        `SELECT field, old_value
           FROM entity_changes
          WHERE entity_type = ? AND entity_ref = ? AND generation > ?
          ORDER BY generation DESC`
      ),
      relationsBefore: db.prepare(
        `SELECT entity_ref, field, old_value
           FROM entity_changes
          WHERE entity_type = 'type' AND field LIKE 'relation:%' AND generation > ?
          ORDER BY generation DESC`
      ),
      // Relaciones en las que este tipo es el ATACANTE. La fila está anotada en
      // el defensor, así que su `entity_ref` es el otro tipo.
      changesAsAttacker: db.prepare(
        `SELECT generation, entity_ref, old_value, new_value, note
           FROM entity_changes
          WHERE entity_type = 'type' AND field = ?
          ORDER BY generation ASC, entity_ref ASC`
      ),
    };
  } catch (err) {
    q = null;
  }

  /** ¿Esta entidad tiene algún cambio registrado? */
  function hasGenerationalDifferences(entityType, entityRef) {
    if (!q || entityRef === undefined || entityRef === null) return false;
    const ref = String(entityRef);
    try {
      if (q.countEntity.get(entityType, ref).c > 0) return true;
      // Un tipo también «cambió» si otro dejó de resistirlo o pasó a resistirlo:
      // su perfil ofensivo se movió aunque su fila no diga nada.
      if (entityType === "type") {
        return q.countAsDefender.get(RELATION_PREFIX + ref).c > 0;
      }
      return false;
    } catch (err) {
      return false;
    }
  }

  /**
   * Todos los cambios de una entidad, de la generación más antigua a la más
   * nueva. Es lo que alimenta las etiquetas de la Tarea 7.2.
   *
   * En un TIPO se suman los dos lados de la tabla: las relaciones anotadas en él
   * (`relation:<atacante>`, donde es el defensor) y aquellas en las que es el
   * atacante, que están anotadas en el OTRO tipo y salen aquí con el prefijo
   * `relation_out:<defensor>`. Sin esto, la ficha de Fantasma diría que tiene
   * diferencias y no sabría enseñar ninguna.
   */
  function changesFor(entityType, entityRef) {
    if (!q || entityRef === undefined || entityRef === null) return [];
    const ref = String(entityRef);
    try {
      const propios = q.changes.all(entityType, ref).map((row) => ({
        generation: row.generation,
        field: row.field,
        old_value: parseValue(row.old_value),
        new_value: parseValue(row.new_value),
        note: row.note,
      }));

      if (entityType !== "type") return propios;

      const ofensivos = q.changesAsAttacker.all(RELATION_PREFIX + ref).map((row) => ({
        generation: row.generation,
        field: RELATION_OUT_PREFIX + String(row.entity_ref),
        old_value: parseValue(row.old_value),
        new_value: parseValue(row.new_value),
        note: row.note,
      }));

      return propios
        .concat(ofensivos)
        .sort((a, b) => a.generation - b.generation || a.field.localeCompare(b.field));
    } catch (err) {
      return [];
    }
  }

  /**
   * Valor de cada campo en una generación concreta.
   *
   * Devuelve `{ campo: valor }` SOLO con los campos que en esa generación
   * valían otra cosa; los que no aparecen conservan el valor actual, igual que
   * un override de sesión que no menciona un campo. Un objeto vacío significa
   * «en esa generación esto era exactamente como hoy».
   */
  function getValueAtGeneration(entityType, entityRef, gen) {
    if (!q || entityRef === undefined || entityRef === null) return {};
    if (!Number.isInteger(gen) || gen >= CURRENT_GENERATION) return {};
    try {
      const valores = {};
      for (const row of q.before.all(entityType, String(entityRef), gen)) {
        valores[row.field] = parseValue(row.old_value);
      }
      return valores;
    } catch (err) {
      return {};
    }
  }

  /**
   * Tabla de tipos de una generación, en la forma que espera
   * `lib/typechart.js` -> `buildChart`: `{ atacante: { defensor: mult } }`.
   *
   * Es global, no por entidad: el perfil defensivo de un Pokémon depende de
   * TODAS las relaciones, no solo de las de sus tipos.
   */
  function chartOverridesAt(gen) {
    if (!q) return null;
    if (!Number.isInteger(gen) || gen >= CURRENT_GENERATION) return null;
    try {
      const overrides = {};
      for (const row of q.relationsBefore.all(gen)) {
        const attacker = row.field.slice(RELATION_PREFIX.length);
        const defender = String(row.entity_ref);
        const value = Number(parseValue(row.old_value));
        if (!attacker || Number.isNaN(value)) continue;
        if (!overrides[attacker]) overrides[attacker] = {};
        overrides[attacker][defender] = value;
      }
      return Object.keys(overrides).length ? overrides : null;
    } catch (err) {
      return null;
    }
  }

  return {
    hasGenerationalDifferences,
    getValueAtGeneration,
    changesFor,
    chartOverridesAt,
  };
}

module.exports = {
  createGenerations,
  parseGeneration,
  parseValue,
  CURRENT_GENERATION,
  MIN_GENERATION,
  RELATION_PREFIX,
  RELATION_OUT_PREFIX,
  ENTITY_BY_PATH,
};
