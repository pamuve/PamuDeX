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

const MIGRATIONS = [
  {
    // Tarea 5.2 — PIN opcional por perfil.
    name: "profiles.pin_hash",
    needed: (db) => !hasColumn(db, "profiles", "pin_hash"),
    run: (db) => db.exec(`ALTER TABLE profiles ADD COLUMN pin_hash TEXT`),
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
