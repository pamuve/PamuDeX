"use strict";

/**
 * PamuDeX — `/api/version`: qué hay desplegado y en qué estado está la base.
 *
 * PARA QUÉ SIRVE
 * --------------
 * Es la respuesta a «¿se aplicó la actualización?» sin entrar por SSH al
 * homelab. Devuelve la versión de la imagen, el commit del que salió, las
 * migraciones que tiene registradas la base y cuándo se hizo la última copia de
 * seguridad. Con eso se diagnostica un despliegue desde el navegador.
 *
 * POR QUÉ NO VA DENTRO DE /api/health
 * -----------------------------------
 * `/api/health` lo consulta el healthcheck de Docker cada 30 segundos y no
 * toca SQLite a propósito: tiene que seguir respondiendo aunque la base esté
 * ocupada. Esto sí lee la base y el directorio de copias, así que va aparte.
 *
 * NO LLEVA DATOS DE NADIE
 * -----------------------
 * Cuenta perfiles y sesiones, pero no devuelve ni un nombre. La API de PamuDeX
 * no tiene autenticación —es una app de red local— y un endpoint de diagnóstico
 * no es sitio para filtrar quién usa la instalación.
 */

const express = require("express");
const { appliedMigrations, MIGRATIONS } = require("../db/migrate");
const { listarCopias, CONSERVAR } = require("../db/backup");
const { version, commit, shortCommit, builtAt } = require("../lib/version");

module.exports = (db) => {
  const router = express.Router();

  router.get("/", (req, res) => {
    const migraciones = appliedMigrations(db);

    // Solo el nombre del archivo, nunca la ruta completa: la ruta del volumen
    // del anfitrión no le importa al navegador.
    const copias = listarCopias().map(({ file, size, mtime }) => ({ file, size, mtime }));

    res.json({
      app: {
        version,
        commit,
        short_commit: shortCommit,
        built_at: builtAt,
        node: process.version,
        uptime_s: Math.round(process.uptime()),
      },
      db: {
        migraciones_aplicadas: migraciones.length,
        migraciones_conocidas: MIGRATIONS.length,
        // Si esto no es cero, la base viene de una versión POSTERIOR del código:
        // alguien volvió a un tag anterior. Las migraciones son solo aditivas,
        // así que funciona, pero conviene verlo.
        pendientes: Math.max(0, MIGRATIONS.length - migraciones.length),
        ultima_migracion: migraciones[0] || null,
        migraciones,
      },
      copias: {
        total: copias.length,
        conservar: CONSERVAR,
        ultima: copias[0] || null,
        listado: copias,
      },
      contenido: contarContenido(db),
    });
  });

  return router;
};

/**
 * Cuántas filas hay de lo que el usuario ha creado. Es la comprobación de que
 * una actualización no se ha llevado nada por delante: si antes había 3 perfiles
 * y 4 sesiones, después tiene que haber 3 y 4.
 */
function contarContenido(db) {
  const contar = (tabla) => {
    try {
      return db.prepare(`SELECT COUNT(*) AS c FROM ${tabla}`).get().c;
    } catch (err) {
      // Tabla que todavía no existe en esta base: cero, no un 500.
      return 0;
    }
  };

  return {
    perfiles: contar("profiles"),
    sesiones: contar("sessions"),
    favoritos: contar("favorites"),
    historial: contar("history"),
    ajustes: contar("settings"),
    reglas_champions: contar("champions_rules"),
  };
}
