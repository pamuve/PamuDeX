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

// Columnas añadidas después de que existiera la base de datos. Es idempotente:
// en una instalación al día no hace nada. Evita tener que resembrar (y perder
// sesiones y perfiles) al actualizar el código.
const { migrate } = require("./db/migrate");
const applied = migrate(db);
if (applied.length) console.log(`Esquema actualizado: ${applied.join(", ")}`);

const app = express();
const PORT = process.env.PORT || 4000;

const sessionOverrides = require("./middleware/sessionOverrides");
const championsMode = require("./middleware/championsMode");
const sessionsRoutes = require("./routes/sessions");
const chartRoutes = require("./routes/chart");

app.use(express.json());

// IMPORTANTE: los dos middlewares van ANTES de las rutas de datos. Interceptan
// res.json; sin su parámetro en la query no hacen nada.
//
// El de Champions va PRIMERO a propósito: los dos modos son excluyentes, y al
// correr antes puede quitar `?session=` de la query para que sessionOverrides
// ni se entere. Si llegan los dos, manda Champions.
app.use("/api", championsMode(db));
app.use("/api", sessionOverrides(db));

app.use("/api/profiles", require("./routes/profiles")(db));
app.use("/api/favorites", require("./routes/favorites")(db));
app.use("/api/history", require("./routes/history")(db));
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

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// En producción, el frontend ya compilado (Vite build) se sirve desde aquí
const FRONTEND_DIST = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "No encontrado" });
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

app.listen(PORT, () => console.log(`PamuDeX API escuchando en el puerto ${PORT}`));
