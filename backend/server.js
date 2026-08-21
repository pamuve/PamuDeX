const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// La ruta sale de db/paths.js: en local es backend/db/pamudex.sqlite, y en
// Docker la variable PAMUDEX_DB_DIR la lleva a /data, un directorio de datos
// puros. El volumen NO puede montarse sobre backend/db/, que es código.
const { DB_PATH, ensureDbDir } = require("./db/paths");
ensureDbDir();

if (!fs.existsSync(DB_PATH)) {
  console.log("No existe la base de datos, ejecutando siembra inicial...");
  require("./db/seed.js");
}

const db = new Database(DB_PATH);

/* --------------------------- actualización del esquema -------------------- */
//
// Columnas y tablas añadidas después de que existiera la base de datos. Es
// idempotente: en una instalación al día no hace nada. Evita tener que resembrar
// (y perder sesiones, perfiles, favoritos, historial y ajustes) al actualizar.
//
// ANTES DE LA PRIMERA ESCRITURA SE COPIA LA BASE. Es lo que convierte una
// actualización en algo reversible: si la migración deja la base en un estado
// que no esperábamos, se restaura y se vuelve al tag anterior de la imagen.
//
// SI FALLA, EL CONTENEDOR NO ARRANCA. Es deliberado y es un cambio respecto al
// comportamiento anterior, que avisaba por consola y seguía: una app sirviendo
// y escribiendo sobre un esquema a medias hace daño de verdad, y el aviso se
// perdía en un log que nadie mira. Caído se ve en Portainer al momento.
const { migrate } = require("./db/migrate");
const { crearCopia, podarCopias, restaurarCopia } = require("./db/backup");
const { version: APP_VERSION } = require("./lib/version");

try {
  const { applied, backup, backfilled } = migrate(db, {
    crearCopia: (etiqueta) => crearCopia(db, etiqueta),
    appVersion: APP_VERSION,
  });

  if (backup) console.log(`Copia de seguridad previa: ${backup}`);
  if (applied.length) console.log(`Esquema actualizado: ${applied.join(", ")}`);
  if (backfilled.length) {
    console.log(`Migraciones ya aplicadas, solo registradas: ${backfilled.length}`);
  }
  // La poda va después de migrar: si algo sale mal, la copia recién hecha es la
  // última que queremos perder.
  const borradas = podarCopias();
  if (borradas.length) console.log(`Copias antiguas eliminadas: ${borradas.length}`);
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  if (err.applied && err.applied.length) {
    console.error(`  Se habían aplicado antes: ${err.applied.join(", ")}`);
  }

  if (err.backup) {
    // Se cierra ANTES de restaurar: no se pisa un archivo con la conexión
    // abierta. Se deshacen también las migraciones que sí habían pasado, para
    // que la actualización sea todo o nada.
    try {
      db.close();
      restaurarCopia(err.backup);
      console.error(`  Base de datos restaurada desde ${err.backup}`);
    } catch (fallo) {
      console.error(`  ✗ No se pudo restaurar la copia: ${fallo.message}`);
      console.error(`    La copia sigue ahí: ${err.backup}`);
    }
  }

  console.error(
    "\n  El contenedor no arranca a propósito: tus datos están intactos.\n" +
      "  Vuelve al tag anterior de la imagen y abre una incidencia con este log.\n"
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

const sessionOverrides = require("./middleware/sessionOverrides");
const championsMode = require("./middleware/championsMode");
const generationMode = require("./middleware/generationMode");
const sessionsRoutes = require("./routes/sessions");
const chartRoutes = require("./routes/chart");

app.use(express.json());

// IMPORTANTE: los tres middlewares van ANTES de las rutas de datos. Interceptan
// res.json, así que ninguna ruta sabe nada de modos.
//
// EL ORDEN DE MONTAJE ES EL INVERSO DEL ORDEN DE TRANSFORMACIÓN: cada uno
// envuelve el res.json del anterior, así que el último en montarse es el
// primero en transformar el cuerpo. Aquí eso da: generación -> sesión ->
// Champions.
//
//  - Champions va PRIMERO en el montaje a propósito: es excluyente con las
//    sesiones de ROM Hack, y al correr antes puede quitar `?session=` de la
//    query para que sessionOverrides ni se entere. Si llegan los dos, manda
//    Champions.
//  - Generación va el ÚLTIMO en el montaje para transformar el PRIMERO: se
//    reconstruye el dato histórico y encima pisan los overrides del ROM Hack,
//    que son una edición explícita del usuario. `?gen=` y `?session=` sí se
//    combinan.
app.use("/api", championsMode(db));
app.use("/api", sessionOverrides(db));
app.use("/api", generationMode(db));

app.use("/api/version", require("./routes/version")(db));
app.use("/api/profiles", require("./routes/profiles")(db));
app.use("/api/favorites", require("./routes/favorites")(db));
// OJO: `/api/history` es el historial de CONSULTAS por perfil (Tarea 5.4). Los
// cambios entre generaciones (7.3) van en `/api/changes`, que es otra cosa.
app.use("/api/history", require("./routes/history")(db));
app.use("/api/changes", require("./routes/changes")(db));
app.use("/api/settings", require("./routes/settings")(db));
app.use("/api/sessions", sessionsRoutes(db));
app.use("/api/chart", chartRoutes(db));
app.use("/api/export", require("./routes/export")(db));
app.use("/api/import", require("./routes/import")(db));

app.use("/api/types", require("./routes/types")(db));
app.use("/api/pokemon", require("./routes/pokemon")(db));
app.use("/api/moves", require("./routes/moves")(db));
app.use("/api/abilities", require("./routes/abilities")(db));
app.use("/api/items", require("./routes/items")(db));
app.use("/api/champions", require("./routes/champions")(db));
app.use("/api/search", require("./routes/search")(db));

// El healthcheck de Docker. NO toca SQLite a propósito: si la base está
// ocupada, el contenedor no debe marcarse como enfermo por eso. La versión se
// lee de una constante, así que sigue sin costar nada; el detalle del
// despliegue (migraciones, copias) está en /api/version.
app.get("/api/health", (req, res) => res.json({ status: "ok", version: APP_VERSION }));

// En producción, el frontend ya compilado (Vite build) se sirve desde aquí
const FRONTEND_DIST = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "No encontrado" });
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

const server = app.listen(PORT, () =>
  console.log(`PamuDeX ${APP_VERSION} escuchando en el puerto ${PORT}`)
);

/* ----------------------------- apagado limpio ----------------------------- */
//
// ESTO NO ES COSMÉTICO, ES LO QUE PROTEGE LA BASE EN CADA ACTUALIZACIÓN.
//
// Actualizar la imagen es `docker stop` + `docker run`, y `docker stop` manda
// SIGTERM al PID 1. Node corre como PID 1 en este contenedor, y en Linux el
// PID 1 IGNORA las señales cuyo manejador no esté registrado explícitamente:
// sin estas dos líneas, SIGTERM no hace nada, Docker espera 10 segundos y
// manda SIGKILL. La conexión de SQLite muere sin cerrar en mitad de lo que
// estuviera haciendo, y eso, en cada redespliegue, es la forma más fácil de
// acabar con un archivo corrupto.
//
// Con el manejador: se deja de aceptar conexiones, se cierra SQLite y se sale.
// Un `docker stop` normal se resuelve en milisegundos.
let apagando = false;
function apagar(senal) {
  if (apagando) return;
  apagando = true;
  console.log(`\n${senal} recibida, cerrando...`);

  server.close(() => {
    try {
      db.close();
    } catch (err) {
      console.error(`✗ Error al cerrar la base de datos: ${err.message}`);
    }
    process.exit(0);
  });

  // Red de seguridad: si una conexión abierta no deja cerrar el servidor, no se
  // espera al SIGKILL de Docker. Se cierra SQLite igual, que es lo que importa.
  setTimeout(() => {
    try {
      db.close();
    } catch (err) {
      /* ya estaba cerrada */
    }
    process.exit(0);
  }, 5000).unref();
}

process.on("SIGTERM", () => apagar("SIGTERM"));
process.on("SIGINT", () => apagar("SIGINT"));
