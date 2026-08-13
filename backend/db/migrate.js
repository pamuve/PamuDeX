"use strict";

/**
 * PamuDeX — migraciones en caliente del esquema.
 *
 * `schema.sql` solo se ejecuta al sembrar la base de datos desde cero. Una
 * instalación que ya está en marcha tiene datos que no se pueden perder
 * (sesiones de ROM Hack, perfiles), así que las columnas nuevas se añaden aquí
 * al arrancar, sin resembrar.
 *
 * Reglas para añadir una migración:
 *  - Idempotente: se ejecuta en CADA arranque, así que debe comprobar antes de
 *    tocar nada.
 *  - Solo aditiva. Nada de DROP ni de renombrar columnas: si el usuario vuelve
 *    a una versión anterior del código, la base de datos debe seguir sirviendo.
 *  - Sin valores por defecto que SQLite no admita en ALTER TABLE.
 */

/** ¿Existe esa columna en la tabla? */
function hasColumn(db, table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((row) => row.name === column);
}

/** ¿Existe esa tabla? */
function hasTable(db, table) {
  const row = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table);
  return Boolean(row);
}

/** ¿Está vacía esa tabla? (false si ni siquiera existe) */
function isEmpty(db, table) {
  if (!hasTable(db, table)) return false;
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c === 0;
}

/** ¿Existe ese índice? */
function hasIndex(db, index) {
  const row = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?`)
    .get(index);
  return Boolean(row);
}

const MIGRATIONS = [
  {
    // Tarea 5.2 — PIN opcional por perfil.
    name: "profiles.pin_hash",
    needed: (db) => !hasColumn(db, "profiles", "pin_hash"),
    run: (db) => db.exec(`ALTER TABLE profiles ADD COLUMN pin_hash TEXT`),
  },
  {
    // Tarea 5.3 — favoritos por perfil. La tabla no existía en el esquema.
    name: "tabla favorites",
    needed: (db) => !hasTable(db, "favorites"),
    run: (db) =>
      db.exec(`
        CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
          entity_type TEXT NOT NULL,
          entity_ref TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_unico
          ON favorites (profile_id, entity_type, entity_ref);
      `),
  },
  {
    // Tarea 5.4 — historial por perfil. La tabla ya venía en schema.sql desde la
    // Fase 1, pero sin usar y sin índice. Las dos consultas de routes/history.js
    // filtran por perfil y ordenan por fecha.
    //
    // NO es un índice único a propósito: el historial es una bitácora, la misma
    // ficha puede aparecer muchas veces. La deduplicación de 5 minutos la hace
    // la ruta.
    name: "índice de history",
    needed: (db) => hasTable(db, "history") && !hasIndex(db, "idx_history_perfil"),
    run: (db) =>
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_history_perfil
          ON history (profile_id, viewed_at);
      `),
  },
  {
    // Tarea 6.0 — objetos. Es la primera migración que trae DATOS, no esquema,
    // y hace falta porque `pnpm run seed` BORRA la base entera: una instalación
    // en marcha perdería perfiles, sesiones, favoritos, historial y ajustes solo
    // por incorporar una entidad nueva del dataset. Aquí entran sin tocar nada.
    //
    // La condición es que la tabla esté VACÍA, así que es idempotente y además
    // respeta al usuario que haya editado sus objetos: si tiene aunque sea uno,
    // esto no vuelve a ejecutarse nunca.
    name: "siembra de items",
    needed: (db) => isEmpty(db, "items"),
    run: (db) => {
      const fs = require("fs");
      const path = require("path");
      const file = path.join(__dirname, "..", "data", "items.json");
      if (!fs.existsSync(file)) return;

      const { insertItems } = require("./populate");
      const items = JSON.parse(fs.readFileSync(file, "utf-8"));
      // En una transacción: son ~2.150 escrituras y sin ella el arranque se va
      // a varios segundos de I/O.
      db.transaction(() => insertItems(db, items))();
    },
  },
];

/**
 * Aplica las migraciones pendientes. Devuelve los nombres de las aplicadas
 * para que server.js lo registre en el log.
 */
function migrate(db) {
  const applied = [];
  for (const migration of MIGRATIONS) {
    try {
      if (!migration.needed(db)) continue;
      migration.run(db);
      applied.push(migration.name);
    } catch (err) {
      // Una migración que falla no debe impedir arrancar: se avisa y se sigue,
      // porque el resto de la app puede funcionar perfectamente sin ella.
      console.error(`✗ Migración fallida (${migration.name}):`, err.message);
    }
  }
  return applied;
}

module.exports = { migrate, hasColumn };
