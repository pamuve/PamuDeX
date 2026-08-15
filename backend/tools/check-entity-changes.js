#!/usr/bin/env node
"use strict";

/**
 * PamuDeX — Tarea 7.3
 * Valida `backend/data/entity_changes.json` contra el dataset.
 *
 *   node tools/check-entity-changes.js
 *
 * POR QUÉ HACE FALTA
 * ------------------
 * El modelo de la Fase 7 reconstruye los valores históricos caminando HACIA
 * ATRÁS desde el valor de hoy (ver `lib/generations.js`), así que el archivo
 * tiene dos invariantes que ningún tipo ni ningún test de humo puede comprobar,
 * porque dependen del contenido del dataset:
 *
 *   1. CADENA: si un campo cambió varias veces, el `new_value` de un cambio debe
 *      ser el `old_value` del siguiente. Un hueco desplaza todo lo anterior.
 *   2. ANCLAJE: el `new_value` del cambio más reciente de un campo debe coincidir
 *      con lo que ese campo vale HOY en la base. Si no, la ficha enseña un valor
 *      histórico que nunca existió.
 *
 * Escribiendo el conjunto inicial, esto detectó un par Bicho/Veneno con los dos
 * `new_value` intercambiados. A ojo no se ve.
 *
 * También avisa de las referencias que no resuelven, que es lo que pasa si el
 * dataset se regenera desde PokeAPI y cambia un nombre.
 *
 * Sale con código 1 si algo falla, para poder encadenarlo.
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { DB_PATH } = require("../db/paths");

if (!fs.existsSync(DB_PATH)) {
  console.error(`✗ No hay base de datos en ${DB_PATH}. Ejecuta antes: pnpm run seed`);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });
const ARCHIVO = path.join(__dirname, "..", "data", "entity_changes.json");
const entradas = JSON.parse(fs.readFileSync(ARCHIVO, "utf-8"));

const buscar = {
  pokemon: db.prepare("SELECT id, name_es FROM pokemon WHERE dex = ?"),
  move: db.prepare("SELECT id, name_es FROM moves WHERE name_es = ?"),
  ability: db.prepare("SELECT id, name_es FROM abilities WHERE name_es = ?"),
};

const consultas = {
  pokemonTypes: db.prepare(
    `SELECT t.id FROM pokemon_types pt JOIN types t ON t.id = pt.type_id
      WHERE pt.pokemon_id = ? ORDER BY pt.slot`
  ),
  relacion: db.prepare(
    "SELECT multiplier FROM relations WHERE attacker_type = ? AND defender_type = ?"
  ),
  tipo: db.prepare("SELECT id FROM types WHERE id = ?"),
};

/** Valor que ese campo tiene HOY en el dataset, o `undefined` si no se sabe leer. */
function valorActual(entityType, id, field) {
  if (entityType === "pokemon" && field === "types") {
    return consultas.pokemonTypes.all(id).map((r) => r.id);
  }
  if (entityType === "move" || entityType === "ability") {
    const tabla = entityType === "move" ? "moves" : "abilities";
    // El nombre de columna sale del propio archivo, así que se valida contra el
    // esquema antes de interpolarlo en el SQL.
    const columnas = db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name);
    if (!columnas.includes(field)) return undefined;
    return db.prepare(`SELECT ${field} AS v FROM ${tabla} WHERE id = ?`).get(id).v;
  }
  if (entityType === "type" && field.startsWith("relation:")) {
    const atacante = field.slice("relation:".length);
    const fila = consultas.relacion.get(atacante, id);
    return fila ? fila.multiplier : 1;
  }
  return undefined;
}

const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const problemas = [];
const cadenas = new Map();

for (const e of entradas) {
  // La primera entrada del archivo son las instrucciones de uso: JSON no admite
  // comentarios de verdad.
  if (!e || !e.entity_type || e.ref === undefined) continue;

  let id = null;
  let nombre = String(e.ref);
  if (e.entity_type === "type") {
    id = consultas.tipo.get(String(e.ref)) ? String(e.ref) : null;
  } else if (buscar[e.entity_type]) {
    const fila = buscar[e.entity_type].get(e.ref);
    if (fila) {
      id = fila.id;
      nombre = fila.name_es;
    }
  } else {
    problemas.push(`entity_type desconocido: ${e.entity_type}`);
    continue;
  }

  if (id === null) {
    problemas.push(`referencia sin resolver: ${e.entity_type} ${JSON.stringify(e.ref)}`);
    continue;
  }

  const clave = `${e.entity_type}|${id}|${e.field}`;
  if (!cadenas.has(clave)) cadenas.set(clave, { entityType: e.entity_type, id, nombre, field: e.field, items: [] });
  cadenas.get(clave).items.push(e);
}

for (const cadena of cadenas.values()) {
  const items = [...cadena.items].sort((a, b) => a.generation - b.generation);
  const donde = `${cadena.entityType} «${cadena.nombre}» · ${cadena.field}`;

  for (let i = 1; i < items.length; i++) {
    if (items[i].generation === items[i - 1].generation) {
      problemas.push(`${donde}: dos cambios en la misma generación (${items[i].generation})`);
    }
    if (!iguales(items[i - 1].new_value, items[i].old_value)) {
      problemas.push(
        `${donde}: cadena rota entre la Gen ${items[i - 1].generation} y la Gen ${items[i].generation} — ` +
          `${JSON.stringify(items[i - 1].new_value)} no empalma con ${JSON.stringify(items[i].old_value)}`
      );
    }
  }

  const hoy = valorActual(cadena.entityType, cadena.id, cadena.field);
  if (hoy === undefined) continue; // campo que este validador no sabe leer
  const ultimo = items[items.length - 1].new_value;
  if (!iguales(hoy, ultimo)) {
    problemas.push(
      `${donde}: el último cambio deja ${JSON.stringify(ultimo)}, pero el dataset tiene ${JSON.stringify(hoy)}`
    );
  }
}

if (problemas.length) {
  console.error(`✗ ${problemas.length} problema(s) en entity_changes.json:\n`);
  for (const p of problemas) console.error(`  · ${p}`);
  process.exit(1);
}

console.log(`✔ ${cadenas.size} cadena(s) de cambios coherentes con el dataset.`);
