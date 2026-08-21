"use strict";

/**
 * PamuDeX — copias de seguridad de la base de datos.
 *
 * POR QUÉ EXISTE ESTO
 * -------------------
 * `/data/pamudex.sqlite` es el único archivo del proyecto que no se puede
 * regenerar: el dataset sale de `backend/data/*.json`, pero los perfiles, las
 * sesiones de ROM Hack, los favoritos, el historial y los ajustes solo están
 * ahí. Actualizar la imagen ejecuta migraciones sobre ese archivo, así que
 * antes de la primera escritura se guarda una copia. Si la actualización sale
 * mal, se vuelve al estado anterior sin perder nada.
 *
 * DÓNDE VAN
 * ---------
 * En `<PAMUDEX_DB_DIR>/backups/`, es decir DENTRO del volumen (`/data/backups`
 * en Docker). Tienen que compartir volumen con la base de datos: una copia que
 * viva en la imagen desaparece en el siguiente despliegue, que es justo cuando
 * hace falta.
 *
 * CÓMO SE COPIA
 * -------------
 * Con `VACUUM INTO`, que SQLite ejecuta de forma atómica y produce un archivo
 * consistente y compactado aunque haya escrituras en curso. Es preferible a
 * copiar el archivo a pelo, que solo es seguro si nadie escribe a la vez.
 * Si `VACUUM INTO` no estuviera disponible (SQLite anterior a 3.27) se copia el
 * archivo, y se acepta porque el único momento en que este módulo se usa sin
 * intervención es el arranque, antes de escuchar en el puerto: no hay nadie
 * escribiendo.
 */

const fs = require("fs");
const path = require("path");
const { DB_DIR, DB_PATH } = require("./paths");

const BACKUP_DIR = path.join(DB_DIR, "backups");

/** Cuántas copias se conservan. `PAMUDEX_BACKUP_KEEP=0` las conserva todas. */
const CONSERVAR = (() => {
  const raw = process.env.PAMUDEX_BACKUP_KEEP;
  if (raw === undefined || raw === "") return 5;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 5;
})();

const PREFIJO = "pamudex-";
const EXT = ".sqlite";

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/** 2026-08-21T07:01:02.123Z -> 20260821-070102 (ordenable como texto). */
function marcaDeTiempo(date = new Date()) {
  const iso = date.toISOString();
  return `${iso.slice(0, 10).replace(/-/g, "")}-${iso.slice(11, 19).replace(/:/g, "")}`;
}

/** Etiqueta apta para nombre de archivo. */
function slug(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

/**
 * Ruta de destino que todavía no existe. Dos copias en el mismo segundo son
 * posibles (arranque + herramienta manual), y `VACUUM INTO` falla si el archivo
 * ya está, así que se desempata con un sufijo.
 */
function rutaLibre(etiqueta) {
  const sufijo = slug(etiqueta);
  const base = `${PREFIJO}${marcaDeTiempo()}${sufijo ? `-${sufijo}` : ""}`;
  let destino = path.join(BACKUP_DIR, `${base}${EXT}`);
  let n = 2;
  while (fs.existsSync(destino)) {
    destino = path.join(BACKUP_DIR, `${base}-${n}${EXT}`);
    n += 1;
  }
  return destino;
}

/**
 * Crea una copia desde una conexión abierta. Devuelve la ruta del archivo.
 * `db` es la conexión de better-sqlite3; `etiqueta` acaba en el nombre.
 */
function crearCopia(db, etiqueta) {
  ensureBackupDir();
  const destino = rutaLibre(etiqueta);
  try {
    db.prepare("VACUUM INTO ?").run(destino);
  } catch (err) {
    fs.copyFileSync(DB_PATH, destino);
  }
  return destino;
}

/**
 * Copia el archivo sin conexión abierta. La usa la restauración para guardar
 * el estado actual antes de pisarlo.
 */
function copiarArchivo(etiqueta) {
  if (!fs.existsSync(DB_PATH)) return null;
  ensureBackupDir();
  const destino = rutaLibre(etiqueta);
  fs.copyFileSync(DB_PATH, destino);
  return destino;
}

/** Las copias existentes, de la más reciente a la más antigua. */
function listarCopias() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(PREFIJO) && f.endsWith(EXT))
    .map((file) => {
      const full = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(full);
      return { file, path: full, size: stat.size, mtime: stat.mtime.toISOString() };
    })
    .sort((a, b) => (a.file < b.file ? 1 : a.file > b.file ? -1 : 0));
}

/**
 * Borra las copias que sobran de la política de retención. Devuelve los nombres
 * eliminados. Con `conservar = 0` no borra nada.
 */
function podarCopias(conservar = CONSERVAR) {
  if (!conservar) return [];
  const sobran = listarCopias().slice(conservar);
  const borradas = [];
  for (const copia of sobran) {
    try {
      fs.unlinkSync(copia.path);
      borradas.push(copia.file);
    } catch (err) {
      // Una copia que no se deja borrar no es motivo para tumbar el arranque.
      console.error(`✗ No se pudo borrar la copia ${copia.file}: ${err.message}`);
    }
  }
  return borradas;
}

/**
 * Restaura una copia sobre la base de datos activa. NO puede haber ninguna
 * conexión abierta: quien llame cierra antes.
 *
 * Los archivos auxiliares de SQLite (`-wal`, `-shm`, `-journal`) se borran
 * porque pertenecen a la base que se está sustituyendo; dejarlos haría que
 * SQLite intentara aplicarlos sobre un archivo que no es el suyo.
 */
function restaurarCopia(origen) {
  const ruta = path.isAbsolute(origen) ? origen : path.join(BACKUP_DIR, origen);
  if (!fs.existsSync(ruta)) throw new Error(`No existe la copia ${ruta}`);

  fs.copyFileSync(ruta, DB_PATH);
  for (const sufijo of ["-wal", "-shm", "-journal"]) {
    const aux = `${DB_PATH}${sufijo}`;
    if (fs.existsSync(aux)) fs.unlinkSync(aux);
  }
  return DB_PATH;
}

module.exports = {
  BACKUP_DIR,
  CONSERVAR,
  crearCopia,
  copiarArchivo,
  listarCopias,
  podarCopias,
  restaurarCopia,
  marcaDeTiempo,
};
