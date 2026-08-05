"use strict";

/**
 * PamuDeX — Tarea 5.2
 * Hash y verificación del PIN de perfil.
 *
 * POR QUÉ scrypt DE node:crypto Y NO bcrypt
 * -----------------------------------------
 * scrypt viene en la biblioteca estándar de Node, así que no añade ninguna
 * dependencia. Eso importa en este proyecto: la política es mantener
 * `allowBuilds` en exactamente dos paquetes, y `bcrypt` es un módulo nativo que
 * obligaría a aprobar otro script de instalación. Para un PIN numérico, bcrypt
 * no aporta nada sobre scrypt, que además es memory-hard.
 *
 * HASTA DÓNDE PROTEGE ESTO — LÉELO ANTES DE CONFIAR EN ELLO
 * --------------------------------------------------------
 * Un PIN de 4 dígitos son 10.000 combinaciones. Quien consiga el archivo
 * pamudex.sqlite agota ese espacio en un momento por muy lento que sea el hash:
 * ningún parámetro de scrypt arregla que el secreto tenga 13 bits de entropía.
 *
 * Lo que sí compra el hash es que nadie lea el PIN en claro abriendo la base de
 * datos con un visor, que es el escenario real en una app doméstica. La defensa
 * que de verdad cuenta contra la fuerza bruta es el límite de intentos del
 * servidor (ver lib/pinThrottle.js), porque el ataque realista es probar PINs
 * contra la propia app, no robar el archivo.
 *
 * Esto protege perfiles entre convivientes. NO es autenticación para exponer
 * PamuDeX a internet.
 */

const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);

// Parámetros por defecto de Node. Se guardan dentro del propio hash para poder
// subirlos en el futuro sin invalidar los PIN ya existentes.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

/** Exactamente 4 dígitos, sin espacios ni signos. */
const PIN_RE = /^[0-9]{4}$/;

/** Comprueba que el PIN tiene el formato admitido. */
function isValidPin(value) {
  return typeof value === "string" && PIN_RE.test(value);
}

/**
 * Deriva el hash de un PIN con una sal aleatoria nueva.
 * Formato guardado: scrypt$N$r$p$<sal hex>$<clave hex>
 */
async function hashPin(pin) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await scrypt(pin, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Comprueba un PIN contra un hash guardado.
 * Devuelve false ante cualquier formato inesperado en lugar de lanzar: un hash
 * corrupto no debe tumbar el servidor, solo denegar el acceso.
 */
async function verifyPin(pin, stored) {
  if (typeof pin !== "string" || typeof stored !== "string") return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number.parseInt(parts[1], 10);
  const r = Number.parseInt(parts[2], 10);
  const p = Number.parseInt(parts[3], 10);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], "hex");
    expected = Buffer.from(parts[5], "hex");
  } catch {
    return false;
  }
  if (!salt.length || !expected.length) return false;

  let actual;
  try {
    actual = await scrypt(pin, salt, expected.length, { N: n, r, p });
  } catch {
    return false;
  }

  // Comparación en tiempo constante: una comparación normal filtra por cuánto
  // tarda en encontrar el primer byte distinto.
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { isValidPin, hashPin, verifyPin, PIN_RE };
