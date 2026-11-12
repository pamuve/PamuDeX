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
 *  - Nombre estable: se guarda en `schema_migrations` y renombrarlo la haría
 *    volver a ejecutarse.
 *
 * EL REGISTRO `schema_migrations`
 * ------------------------------
 * Cada migración aplicada deja una fila con su nombre y la fecha. `needed()`
 * sigue existiendo y sigue mandando —es la única defensa cuando el registro no
 * existe todavía—, pero ahora hay una respuesta a «qué versión de esquema tiene
 * esta base», que es lo que hace falta para diagnosticar un despliegue.
 *
 * Una base anterior al registro se rellena sola: las migraciones que no hacen
 * falta (`needed()` es falso) se anotan SIN ejecutarse. Así una instalación al
 * día no repite trabajo ni se marca como pendiente para siempre.
 *
 * QUÉ PASA SI UNA FALLA
 * ---------------------
 * Se aborta. Cada migración corre dentro de una transacción, así que la que
 * falla se deshace entera, y `migrate()` lanza un `MigrationError` con la ruta
 * de la copia de seguridad previa para que `server.js` la restaure y salga con
 * error.
 *
 * Antes se avisaba por consola y se seguía arrancando. Es peor: la app quedaba
 * sirviendo contra un esquema a medias y escribiendo encima, y el aviso se
 * perdía en el log de un contenedor que nadie mira. Un contenedor caído se ve
 * en Portainer al instante y deja los datos intactos.
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

/* ------------------------- registro de migraciones ------------------------ */

const REGISTRO = "schema_migrations";

/**
 * Crea el registro si no está. No va en `schema.sql` a propósito: ese archivo
 * también alimenta la exportación a SQLite (`routes/export.js`), y el registro
 * es estado de ESTA instalación, no parte del dataset.
 */
function ensureRegistry(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${REGISTRO} (
      name        TEXT PRIMARY KEY,
      applied_at  TEXT NOT NULL,
      app_version TEXT
    );
  `);
}

/** Nombres ya registrados. */
function readRegistry(db) {
  return new Set(db.prepare(`SELECT name FROM ${REGISTRO}`).all().map((r) => r.name));
}

/** Anota una migración. `INSERT OR IGNORE` para que sea idempotente. */
function record(db, name, appVersion) {
  db.prepare(
    `INSERT OR IGNORE INTO ${REGISTRO} (name, applied_at, app_version) VALUES (?, ?, ?)`
  ).run(name, new Date().toISOString(), appVersion || null);
}

/** Lo aplicado, de lo más reciente a lo más antiguo. Lo usa /api/version. */
function appliedMigrations(db) {
  if (!hasTable(db, REGISTRO)) return [];
  return db
    .prepare(`SELECT name, applied_at, app_version FROM ${REGISTRO} ORDER BY applied_at DESC, name DESC`)
    .all();
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
  {
    // Tarea 7.1 — cambios históricos entre generaciones. Tabla nueva, así que
    // una base que ya estaba en marcha no la tiene. Solo el esquema: los datos
    // los carga la 7.3.
    name: "tabla entity_changes",
    needed: (db) => !hasTable(db, "entity_changes"),
    run: (db) =>
      db.exec(`
        CREATE TABLE IF NOT EXISTS entity_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_ref TEXT NOT NULL,
          generation INTEGER NOT NULL,
          field TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          note TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_entity_changes_entidad
          ON entity_changes (entity_type, entity_ref, generation);
        CREATE INDEX IF NOT EXISTS idx_entity_changes_campo
          ON entity_changes (field, generation);
      `),
  },
  {
    // Tarea 7.3 — el conjunto inicial de cambios históricos. Igual que la
    // siembra de objetos de la 6.0: entra por migración porque `pnpm run seed`
    // borra la base entera y una instalación en marcha perdería perfiles,
    // sesiones, favoritos, historial y ajustes.
    //
    // Condicionado a que la tabla esté VACÍA, así que es idempotente y respeta
    // al usuario que haya editado su historial: con una sola fila propia, esto
    // no vuelve a ejecutarse nunca.
    //
    // OJO al orden: depende de la migración anterior, que crea la tabla. Las
    // migraciones se aplican en el orden de este array.
    name: "siembra de entity_changes",
    needed: (db) => isEmpty(db, "entity_changes"),
    run: (db) => {
      const fs = require("fs");
      const path = require("path");
      const file = path.join(__dirname, "..", "data", "entity_changes.json");
      if (!fs.existsSync(file)) return;

      const { insertEntityChanges } = require("./populate");
      const rows = JSON.parse(fs.readFileSync(file, "utf-8"));
      db.transaction(() => insertEntityChanges(db, rows))();
    },
  },
  /* ------------------------- Fase 9 — ampliaciones ------------------------ */
  //
  // CREAR Y SEMBRAR VAN EN LA MISMA MIGRACIÓN. `migrate()` decide qué hace
  // falta en una primera pasada, ANTES de ejecutar nada: una migración de
  // siembra aparte, con la condición «la tabla está vacía», se evaluaría cuando
  // la tabla todavía no existe, saldría como «no hace falta» y quedaría anotada
  // sin haberse ejecutado nunca. Como cada migración corre en su transacción y
  // en SQLite el DDL es transaccional, si la siembra falla tampoco queda la
  // tabla y el arranque siguiente lo reintenta entero.
  {
    name: "tabla pokemon_moves",
    needed: (db) => !hasTable(db, "pokemon_moves") || isEmpty(db, "pokemon_moves"),
    run: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS pokemon_moves (
          pokemon_id INTEGER NOT NULL,
          move_id INTEGER NOT NULL,
          method TEXT NOT NULL,
          level INTEGER,
          PRIMARY KEY (pokemon_id, move_id, method)
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS idx_pokemon_moves_movimiento ON pokemon_moves (move_id);
      `);
      require("./extras").seedLearnsets(db);
    },
  },
  {
    name: "tabla evolutions",
    needed: (db) => !hasTable(db, "evolutions") || isEmpty(db, "evolutions"),
    run: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS evolutions (
          from_pokemon_id INTEGER NOT NULL,
          to_pokemon_id INTEGER NOT NULL,
          method_es TEXT,
          method_en TEXT,
          PRIMARY KEY (from_pokemon_id, to_pokemon_id)
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS idx_evolutions_destino ON evolutions (to_pokemon_id);
      `);
      require("./extras").seedEvolutions(db);
    },
  },
  {
    name: "tabla pokemon_forms",
    needed: (db) => !hasTable(db, "pokemon_forms") || isEmpty(db, "pokemon_forms"),
    run: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS pokemon_forms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pokemon_id INTEGER NOT NULL,
          form_key TEXT NOT NULL UNIQUE,
          sprite_id INTEGER,
          kind TEXT NOT NULL,
          name_es TEXT NOT NULL,
          name_en TEXT NOT NULL,
          types_json TEXT NOT NULL,
          hp INTEGER, atk INTEGER, def INTEGER, spa INTEGER, spd INTEGER, spe INTEGER,
          height_m REAL,
          weight_kg REAL
        );
        CREATE INDEX IF NOT EXISTS idx_pokemon_forms_pokemon ON pokemon_forms (pokemon_id);
      `);
      require("./extras").seedForms(db);
    },
  },
  {
    // Efectos en inglés. Tres columnas, una por tabla; cada ALTER se salta si
    // la columna ya está, para que un fallo a mitad no deje la migración sin
    // poder repetirse.
    name: "columnas effect_en",
    needed: (db) =>
      ["moves", "abilities", "items"].some((t) => hasTable(db, t) && !hasColumn(db, t, "effect_en")) ||
      !require("./extras").hasAnyEffectEn(db),
    run: (db) => {
      for (const tabla of ["moves", "abilities", "items"]) {
        if (hasTable(db, tabla) && !hasColumn(db, tabla, "effect_en")) {
          db.exec(`ALTER TABLE ${tabla} ADD COLUMN effect_en TEXT`);
        }
      }
      require("./extras").fillEffectsEn(db);
    },
  },
  {
    name: "tabla teams",
    needed: (db) => !hasTable(db, "teams"),
    run: (db) =>
      db.exec(`
        CREATE TABLE IF NOT EXISTS teams (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          scope TEXT NOT NULL DEFAULT 'global',
          name TEXT NOT NULL,
          data_json TEXT NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_teams_perfil ON teams (profile_id, scope);
      `),
  },
  {
    name: "tabla captures",
    needed: (db) => !hasTable(db, "captures"),
    run: (db) =>
      db.exec(`
        CREATE TABLE IF NOT EXISTS captures (
          profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          scope TEXT NOT NULL DEFAULT 'global',
          pokemon_id INTEGER NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (profile_id, scope, pokemon_id)
        ) WITHOUT ROWID;
      `),
  },
];

/**
 * Aplica las migraciones pendientes.
 *
 * `opciones.crearCopia(etiqueta)` es la función que hace la copia de seguridad;
 * se inyecta en vez de importar `db/backup.js` para que las pruebas puedan
 * comprobar CUÁNDO se llama sin tocar el disco. Si no se pasa, no se copia
 * nada: es lo que quiere una prueba, nunca un arranque real.
 *
 * Devuelve `{ applied, backup, backfilled }`:
 *  - `applied`    nombres de las migraciones ejecutadas de verdad,
 *  - `backup`     ruta de la copia previa (null si no hubo nada que hacer),
 *  - `backfilled` las que solo se anotaron porque ya estaban aplicadas.
 *
 * Lanza `MigrationError` si alguna falla, con `backup` y `applied` dentro.
 */
function migrate(db, opciones = {}) {
  const { crearCopia = null, appVersion = null } = opciones;

  ensureRegistry(db);
  const yaRegistradas = readRegistry(db);

  // Primera pasada: separar lo que hay que ejecutar de lo que solo hay que
  // anotar. La anotación va antes de tocar el esquema porque es inofensiva y
  // deja el registro coherente aunque luego falle una migración de verdad.
  const porEjecutar = [];
  const backfilled = [];
  for (const migration of MIGRATIONS) {
    if (yaRegistradas.has(migration.name)) continue;
    if (!migration.needed(db)) {
      record(db, migration.name, appVersion);
      backfilled.push(migration.name);
      continue;
    }
    porEjecutar.push(migration);
  }

  if (!porEjecutar.length) return { applied: [], backup: null, backfilled };

  // LA COPIA VA AQUÍ: hay algo que cambiar y todavía no se ha cambiado nada.
  // Fuera de la transacción, porque VACUUM INTO no puede correr dentro de una.
  const backup = crearCopia ? crearCopia("pre-migracion") : null;

  const applied = [];
  for (const migration of porEjecutar) {
    try {
      // Una transacción por migración: si falla a medias, no queda a medias.
      // Las migraciones que abren su propia transacción (la siembra de objetos)
      // anidan con SAVEPOINT, que better-sqlite3 gestiona solo.
      db.transaction(() => {
        migration.run(db);
        record(db, migration.name, appVersion);
      })();
      applied.push(migration.name);
    } catch (err) {
      const error = new Error(`Migración fallida (${migration.name}): ${err.message}`);
      error.name = "MigrationError";
      error.migration = migration.name;
      error.backup = backup;
      error.applied = applied;
      error.cause = err;
      throw error;
    }
  }

  return { applied, backup, backfilled };
}

module.exports = { migrate, hasColumn, appliedMigrations, MIGRATIONS, REGISTRO };
