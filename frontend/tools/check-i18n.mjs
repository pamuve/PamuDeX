/**
 * PamuDeX — comprobación de los archivos de idioma.
 *
 * POR QUÉ HACE FALTA UN SCRIPT PARA ESTO
 * --------------------------------------
 * `i18n/index.tsx` hace `dict[key]` y devuelve la clave cruda si no la
 * encuentra. Eso significa que una clave que falte en `en.json` NO rompe el
 * build, NO da un error de tipos y NO se ve en español: se ve solo si alguien
 * abre esa pantalla en inglés. Es el fallo más fácil de colar del proyecto, y
 * el único que no atrapa `tsc`.
 *
 * Comprueba tres cosas:
 *   1. Que los dos archivos tengan EXACTAMENTE las mismas claves.
 *   2. Que sean PLANOS. Un objeto anidado no lo recorre `dict[key]`, así que la
 *      app pintaría la clave literal en pantalla.
 *   3. Que no haya claves repetidas dentro de un archivo. `JSON.parse` se queda
 *      con la última sin decir nada, así que una traducción puede desaparecer
 *      sin dejar rastro.
 *
 * Los parámetros ({{name}}) que no cuadran se avisan, pero no tumban la
 * comprobación: hay frases que legítimamente no usan todos sus parámetros en
 * los dos idiomas.
 *
 * Uso:  pnpm run check:i18n
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const I18N = path.join(AQUI, "..", "src", "i18n");
const IDIOMAS = ["es", "en"];

let errores = 0;
let avisos = 0;

const error = (msg) => {
  console.error(`✗ ${msg}`);
  errores += 1;
};
const aviso = (msg) => {
  console.warn(`⚠ ${msg}`);
  avisos += 1;
};

/* --------------------------- carga y comprobaciones ----------------------- */

const dicts = {};

for (const lang of IDIOMAS) {
  const file = path.join(I18N, `${lang}.json`);
  const raw = readFileSync(file, "utf-8");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    error(`${lang}.json no es JSON válido: ${err.message}`);
    process.exit(1);
  }

  // 2. Planos. Un valor que no sea cadena es una clave anidada o un número
  //    suelto, y en los dos casos la app no lo pinta como texto.
  for (const [clave, valor] of Object.entries(parsed)) {
    if (typeof valor !== "string") {
      error(
        `${lang}.json: "${clave}" no es una cadena (${
          Array.isArray(valor) ? "array" : typeof valor
        }). Los JSON de idioma son PLANOS: aplana la clave a "${clave}.loQueSea".`
      );
    }
  }

  // 3. Repetidas. Se cuentan sobre el texto en crudo porque JSON.parse ya se ha
  //    comido la primera de las dos.
  const vistas = new Set();
  for (const match of raw.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)) {
    const clave = match[1];
    if (vistas.has(clave)) error(`${lang}.json: la clave "${clave}" está repetida`);
    vistas.add(clave);
  }

  dicts[lang] = parsed;
}

// 1. Mismo juego de claves en los dos.
const [base, otro] = IDIOMAS;
const clavesBase = new Set(Object.keys(dicts[base]));
const clavesOtro = new Set(Object.keys(dicts[otro]));

for (const clave of clavesBase) {
  if (!clavesOtro.has(clave)) error(`falta en ${otro}.json: "${clave}"`);
}
for (const clave of clavesOtro) {
  if (!clavesBase.has(clave)) error(`falta en ${base}.json: "${clave}"`);
}

// Parámetros: solo aviso.
const parametros = (texto) =>
  new Set(Array.from(String(texto).matchAll(/\{\{(\w+)\}\}/g), (m) => m[1]));

for (const clave of clavesBase) {
  if (!clavesOtro.has(clave)) continue;
  const a = parametros(dicts[base][clave]);
  const b = parametros(dicts[otro][clave]);
  const soloEnA = [...a].filter((p) => !b.has(p));
  const soloEnB = [...b].filter((p) => !a.has(p));
  if (soloEnA.length || soloEnB.length) {
    aviso(
      `"${clave}": parámetros distintos (${base}: ${[...a].join(", ") || "ninguno"} / ` +
        `${otro}: ${[...b].join(", ") || "ninguno"})`
    );
  }
}

/* ---------------------------------- final --------------------------------- */

const total = clavesBase.size;
if (errores) {
  console.error(`\n${errores} error(es) en los archivos de idioma.`);
  process.exit(1);
}

console.log(`✔ ${total} claves, idénticas en ${IDIOMAS.join(" y ")}, todas planas y sin repetir.`);
if (avisos) console.log(`  (${avisos} aviso[s] de parámetros, no bloquean.)`);
