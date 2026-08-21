"use strict";

/**
 * PamuDeX — qué versión está corriendo.
 *
 * POR QUÉ POR VARIABLES DE ENTORNO Y NO POR package.json
 * ------------------------------------------------------
 * `package.json` dice `0.1.0` desde la Fase 1 y no lo toca nadie al desplegar.
 * Lo que hace falta saber en un homelab es «qué commit es esta imagen», y eso
 * solo lo sabe quien la construye. El workflow de GitHub Actions lo inyecta
 * como `ARG` y el Dockerfile lo convierte en `ENV`, así que la imagen se
 * identifica a sí misma sin que haya que acordarse de subir un número a mano.
 *
 * En local no hay ninguna de las tres variables y se cae al valor de
 * `package.json` con `commit: null`, que es exactamente lo que hay que ver
 * cuando estás en tu máquina: no hay imagen ni despliegue del que hablar.
 */

const pkg = require("../package.json");

const version = process.env.PAMUDEX_VERSION || pkg.version;
const commit = process.env.PAMUDEX_COMMIT || null;
const builtAt = process.env.PAMUDEX_BUILD_DATE || null;

/** El commit corto es lo que se enseña; el largo sirve para buscar en git. */
const shortCommit = commit ? commit.slice(0, 7) : null;

module.exports = { version, commit, shortCommit, builtAt };
