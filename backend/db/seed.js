// Crea (o recrea) la base de datos SQLite y la puebla con los datos semilla de /backend/data
// Uso: node db/seed.js

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { populate } = require("./populate");

// Ruta compartida con server.js: en Docker la lleva a /data (ver db/paths.js).
const { DB_PATH, SCHEMA_PATH, ensureDbDir } = require("./paths");
const DATA_DIR = path.join(__dirname, "..", "data");

function readJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

function seed() {
  ensureDbDir();
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  const db = new Database(DB_PATH);
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));

  // El volcado vive en populate.js porque lo comparte con la exportación a
  // SQLite (routes/export.js). Un solo sitio que tocar cuando cambie el esquema.
  const counts = populate(db, {
    types: readJSON("types.json"),
    typeChart: readJSON("type_chart.json"),
    pokemon: readJSON("pokemon.json"),
    moves: readJSON("moves.json"),
    abilities: readJSON("abilities.json"),
  });

  console.log(`✔ Base de datos creada en ${DB_PATH}`);
  console.log(
    `  · ${counts.types} tipos, ${counts.pokemon} Pokémon, ${counts.moves} movimientos, ${counts.abilities} habilidades`
  );
  db.close();
}

seed();
