"use strict";

/**
 * PamuDeX — copia de seguridad a mano.
 *
 *   node tools/backup.js            crea una copia y aplica la retención
 *   node tools/backup.js --list     solo enseña las que hay
 *   node tools/backup.js --keep=20  crea una copia conservando 20
 *
 * En Docker:
 *   docker exec pamudex node tools/backup.js
 *
 * El arranque ya copia la base antes de migrar, así que esto es para lo otro:
 * antes de importar un dataset con `target=global`, antes de tocar la tabla de
 * tipos a lo bruto, o simplemente porque hoy toca.
 *
 * SE PUEDE EJECUTAR CON LA APP EN MARCHA. `VACUUM INTO` produce un archivo
 * consistente aunque haya escrituras a la vez; por eso la copia se hace desde
 * una conexión SQLite y no con `cp`.
 */

const fs = require("fs");
const Database = require("better-sqlite3");
const { DB_PATH } = require("../db/paths");
const { crearCopia, listarCopias, podarCopias, BACKUP_DIR } = require("../db/backup");

const args = process.argv.slice(2);
const soloListar = args.includes("--list") || args.includes("-l");
const keepArg = args.find((a) => a.startsWith("--keep="));
const conservar = keepArg ? Number(keepArg.split("=")[1]) : undefined;

function humano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function listar() {
  const copias = listarCopias();
  if (!copias.length) {
    console.log(`No hay copias en ${BACKUP_DIR}`);
    return;
  }
  console.log(`Copias en ${BACKUP_DIR} (de la más reciente a la más antigua):`);
  for (const c of copias) console.log(`  ${c.file}  ${humano(c.size)}  ${c.mtime}`);
}

if (soloListar) {
  listar();
  process.exit(0);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`✗ No existe la base de datos en ${DB_PATH}`);
  console.error("  Arranca el servidor una vez: la siembra inicial la crea sola.");
  process.exit(1);
}

// `readonly` no vale: VACUUM INTO necesita escribir en el destino y SQLite pide
// la conexión en modo normal.
const db = new Database(DB_PATH);
try {
  const destino = crearCopia(db, "manual");
  console.log(`✔ Copia creada: ${destino}`);
  const borradas = podarCopias(conservar);
  if (borradas.length) console.log(`  Eliminadas por retención: ${borradas.join(", ")}`);
} catch (err) {
  console.error(`✗ No se pudo crear la copia: ${err.message}`);
  process.exit(1);
} finally {
  db.close();
}

listar();
