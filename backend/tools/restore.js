"use strict";

/**
 * PamuDeX — restaurar una copia de seguridad.
 *
 *   node tools/restore.js                     enseña las copias disponibles
 *   node tools/restore.js <archivo> --si      restaura esa copia
 *
 * En Docker hay que PARAR el contenedor antes: mientras la app corre tiene la
 * base abierta, y sustituirle el archivo por debajo deja la conexión apuntando
 * a algo que ya no existe. Como el contenedor es el que lleva el código, se
 * restaura con uno de usar y tirar sobre el mismo volumen:
 *
 *   docker stop pamudex
 *   docker run --rm -v pamudex_pamudex_db:/data ghcr.io/pamuve/pamudex:latest \
 *     node tools/restore.js pamudex-20260821-070102-pre-migracion.sqlite --si
 *   docker start pamudex
 *
 * Antes de pisar nada se guarda el estado actual como una copia más
 * (`-antes-de-restaurar`), así que una restauración equivocada también se
 * deshace.
 */

const fs = require("fs");
const path = require("path");
const { DB_PATH } = require("../db/paths");
const { listarCopias, restaurarCopia, copiarArchivo, BACKUP_DIR } = require("../db/backup");

const args = process.argv.slice(2);
const confirmado = args.includes("--si") || args.includes("--yes");
const objetivo = args.find((a) => !a.startsWith("-"));

function humano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const copias = listarCopias();

if (!objetivo) {
  if (!copias.length) {
    console.log(`No hay copias en ${BACKUP_DIR}`);
    process.exit(0);
  }
  console.log(`Copias disponibles en ${BACKUP_DIR}:\n`);
  for (const c of copias) console.log(`  ${c.file}  ${humano(c.size)}  ${c.mtime}`);
  console.log("\nPara restaurar, con el servidor PARADO:");
  console.log(`  node tools/restore.js ${copias[0].file} --si`);
  process.exit(0);
}

const ruta = path.isAbsolute(objetivo) ? objetivo : path.join(BACKUP_DIR, objetivo);
if (!fs.existsSync(ruta)) {
  console.error(`✗ No existe la copia ${ruta}`);
  console.error("  Ejecuta `node tools/restore.js` sin argumentos para ver la lista.");
  process.exit(1);
}

if (!confirmado) {
  console.log(`Se va a sustituir ${DB_PATH}`);
  console.log(`               por ${ruta}`);
  console.log("\nEl servidor tiene que estar PARADO. Si lo está, repite con --si:");
  console.log(`  node tools/restore.js ${objetivo} --si`);
  process.exit(0);
}

try {
  const previa = copiarArchivo("antes-de-restaurar");
  if (previa) console.log(`Estado actual guardado en ${previa}`);
  restaurarCopia(ruta);
  console.log(`✔ Restaurada ${path.basename(ruta)} sobre ${DB_PATH}`);
  console.log("  Arranca el servidor: las migraciones pendientes se aplicarán solas.");
} catch (err) {
  console.error(`✗ No se pudo restaurar: ${err.message}`);
  process.exit(1);
}
