/**
 * Prueba de humo del sistema de actualizaciones: el registro `schema_migrations`
 * y lo que pasa cuando una migración falla. Con `db` simulada, sin SQLite ni
 * servidor, como el resto de las pruebas del proyecto.
 *
 * Lo que se comprueba aquí es el ORQUESTADOR, no el SQL de cada migración:
 *
 *  - una base ya al día se registra sola sin volver a ejecutar nada,
 *  - la copia de seguridad se hace ANTES de la primera escritura, y solo si de
 *    verdad hay algo que ejecutar,
 *  - una migración fallida aborta con la ruta de la copia y NO se anota.
 *
 * El orden importa más que el resultado: una copia hecha después de migrar no
 * sirve para nada, y es un fallo que no se nota hasta el día que hace falta.
 */

const assert = require("assert");
const { migrate, appliedMigrations, MIGRATIONS } = require("../db/migrate");

/* ---------------------------------------------------------------- */
/* Base de datos simulada                                            */
/* ---------------------------------------------------------------- */

/**
 * `estado` describe la base: qué tablas, columnas e índices tiene y cuántas
 * filas hay en cada tabla. Es justo lo que consultan los `needed()`.
 */
function crearDb(estado = {}) {
  const tablas = new Set(estado.tablas || []);
  const columnas = estado.columnas || {};
  const indices = new Set(estado.indices || []);
  const filas = estado.filas || {};
  const registro = [];
  const log = [];

  const db = {
    log,
    registro,
    tablas,

    exec(sql) {
      log.push({ tipo: "exec", sql });
      const match = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(sql);
      if (match) tablas.add(match[1]);
    },

    prepare(sql) {
      if (sql.includes("PRAGMA table_info")) {
        const tabla = /table_info\((\w+)\)/.exec(sql)[1];
        return { all: () => (columnas[tabla] || []).map((name) => ({ name })) };
      }
      if (sql.includes("sqlite_master") && sql.includes("'table'")) {
        return { get: (name) => (tablas.has(name) ? { 1: 1 } : undefined) };
      }
      if (sql.includes("sqlite_master") && sql.includes("'index'")) {
        return { get: (name) => (indices.has(name) ? { 1: 1 } : undefined) };
      }
      if (sql.includes("COUNT(*)")) {
        const tabla = /FROM (\w+)/.exec(sql)[1];
        return { get: () => ({ c: filas[tabla] || 0 }) };
      }
      if (sql.includes("SELECT name FROM schema_migrations")) {
        return { all: () => registro.map((r) => ({ name: r.name })) };
      }
      if (sql.includes("SELECT name, applied_at, app_version")) {
        return { all: () => registro.slice().reverse() };
      }
      if (sql.includes("INSERT OR IGNORE INTO schema_migrations")) {
        return {
          run: (name, appliedAt, appVersion) => {
            log.push({ tipo: "anotar", name });
            if (registro.some((r) => r.name === name)) return { changes: 0 };
            registro.push({ name, applied_at: appliedAt, app_version: appVersion });
            return { changes: 1 };
          },
        };
      }
      throw new Error(`SQL no simulado: ${sql}`);
    },

    // better-sqlite3 devuelve una función que corre `fn` en una transacción. La
    // parte que importa aquí es que si `fn` lanza, lo que hiciera dentro no
    // queda: se simula deshaciendo las anotaciones del registro.
    transaction(fn) {
      return (...args) => {
        const antes = registro.length;
        try {
          return fn(...args);
        } catch (err) {
          registro.length = antes;
          throw err;
        }
      };
    },
  };

  return db;
}

/** Una base con TODO lo que traen las migraciones actuales ya aplicado. */
function dbAlDia() {
  return crearDb({
    tablas: ["profiles", "favorites", "history", "items", "entity_changes", "sessions"],
    columnas: { profiles: ["id", "name", "pin_hash"] },
    indices: ["idx_history_perfil"],
    filas: { items: 2151, entity_changes: 120 },
  });
}

/** Sustituye la lista real de migraciones y devuelve cómo dejarla como estaba. */
function conMigraciones(lista) {
  const original = MIGRATIONS.slice();
  MIGRATIONS.splice(0, MIGRATIONS.length, ...lista);
  return () => MIGRATIONS.splice(0, MIGRATIONS.length, ...original);
}

/* ---------------------------------------------------------------- */
/* 1. Una instalación al día se registra sin ejecutar nada           */
/* ---------------------------------------------------------------- */

{
  const db = dbAlDia();
  const copias = [];
  const { applied, backup, backfilled } = migrate(db, {
    crearCopia: (etiqueta) => {
      copias.push(etiqueta);
      return "/data/backups/no-deberia-existir.sqlite";
    },
    appVersion: "1.2.3",
  });

  assert.deepStrictEqual(applied, [], "no debe ejecutarse ninguna migración");
  assert.strictEqual(backup, null, "sin migraciones que ejecutar no se copia nada");
  assert.strictEqual(copias.length, 0, "no se debe llamar a crearCopia");
  assert.strictEqual(
    backfilled.length,
    MIGRATIONS.length,
    "todas las migraciones conocidas deben quedar registradas"
  );

  const registradas = appliedMigrations(db);
  assert.strictEqual(registradas.length, MIGRATIONS.length);
  assert.strictEqual(registradas[0].app_version, "1.2.3", "se anota la versión que migró");

  console.log("✔ Una base ya al día se registra sola, sin ejecutar ni copiar nada");
}

/* ---------------------------------------------------------------- */
/* 2. El segundo arranque no vuelve a mirar nada                     */
/* ---------------------------------------------------------------- */

{
  const db = dbAlDia();
  migrate(db, { appVersion: "1.2.3" });
  const segunda = migrate(db, { appVersion: "1.2.3" });

  assert.deepStrictEqual(segunda.applied, []);
  assert.deepStrictEqual(segunda.backfilled, [], "ya estaban registradas");
  assert.strictEqual(db.registro.length, MIGRATIONS.length, "no se duplican filas");

  console.log("✔ El segundo arranque no repite el registro: es idempotente");
}

/* ---------------------------------------------------------------- */
/* 3. La copia se hace ANTES de la primera escritura                 */
/* ---------------------------------------------------------------- */

{
  const orden = [];
  const restaurar = conMigraciones([
    {
      name: "ya-estaba",
      needed: () => false,
      run: () => orden.push("run:ya-estaba"),
    },
    {
      name: "hace-falta",
      needed: () => true,
      run: () => orden.push("run:hace-falta"),
    },
  ]);

  try {
    const db = crearDb();
    const { applied, backup, backfilled } = migrate(db, {
      crearCopia: (etiqueta) => {
        orden.push(`copia:${etiqueta}`);
        return "/data/backups/pamudex-20260821-070102-pre-migracion.sqlite";
      },
    });

    assert.deepStrictEqual(applied, ["hace-falta"]);
    assert.deepStrictEqual(backfilled, ["ya-estaba"], "la que no hacía falta solo se anota");
    assert.ok(backup, "tiene que devolver la ruta de la copia");
    assert.deepStrictEqual(
      orden,
      ["copia:pre-migracion", "run:hace-falta"],
      "la copia va antes de tocar la base"
    );
    assert.deepStrictEqual(
      db.registro.map((r) => r.name),
      ["ya-estaba", "hace-falta"]
    );
  } finally {
    restaurar();
  }

  console.log("✔ La copia de seguridad se hace antes de la primera escritura");
}

/* ---------------------------------------------------------------- */
/* 4. Una migración que falla aborta y no se anota                   */
/* ---------------------------------------------------------------- */

{
  const restaurar = conMigraciones([
    { name: "buena", needed: () => true, run: () => {} },
    {
      name: "rota",
      needed: () => true,
      run: () => {
        throw new Error("no such column: inventada");
      },
    },
    { name: "nunca-llega", needed: () => true, run: () => assert.fail("no debe ejecutarse") },
  ]);

  try {
    const db = crearDb();
    const RUTA = "/data/backups/pamudex-20260821-070102-pre-migracion.sqlite";
    let error = null;

    try {
      migrate(db, { crearCopia: () => RUTA });
    } catch (err) {
      error = err;
    }

    assert.ok(error, "migrate() tiene que lanzar, no tragarse el fallo");
    assert.strictEqual(error.name, "MigrationError");
    assert.strictEqual(error.migration, "rota");
    assert.strictEqual(error.backup, RUTA, "el error lleva la copia para restaurarla");
    assert.deepStrictEqual(error.applied, ["buena"], "dice qué llegó a aplicarse");
    assert.ok(/no such column/.test(error.message), "conserva el error original");

    assert.deepStrictEqual(
      db.registro.map((r) => r.name),
      ["buena"],
      "la migración fallida no queda registrada"
    );
  } finally {
    restaurar();
  }

  console.log("✔ Una migración fallida aborta, no se anota y trae su copia");
}

/* ---------------------------------------------------------------- */
/* 5. Una base recién sembrada: solo lo que le falte de verdad       */
/* ---------------------------------------------------------------- */

{
  // Como sale de `schema.sql`: están todas las tablas, pero no el índice del
  // historial ni los datos de items/entity_changes, que los carga la migración.
  const db = crearDb({
    tablas: ["profiles", "favorites", "history", "items", "entity_changes", "sessions"],
    columnas: { profiles: ["id", "name", "pin_hash"] },
    indices: [],
    filas: { items: 2151, entity_changes: 120 },
  });

  const { applied, backfilled } = migrate(db, { crearCopia: () => "/tmp/copia.sqlite" });

  assert.deepStrictEqual(applied, ["índice de history"], "solo falta el índice");
  assert.strictEqual(backfilled.length, MIGRATIONS.length - 1);
  assert.strictEqual(appliedMigrations(db).length, MIGRATIONS.length);

  console.log("✔ Una base recién sembrada solo ejecuta lo que le falta");
}

console.log("\nTodas las pruebas del sistema de actualizaciones han pasado.");
