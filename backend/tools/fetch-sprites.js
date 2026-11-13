/**
 * Descarga los sprites a frontend/public/sprites/: el normal y el variocolor de
 * los 1025 Pokémon (<dex>.png y shiny/<dex>.png) y el de cada forma de
 * data/forms.json (forms/<id>.png). Unos 2300 archivos, ~3 MB.
 *
 *   node tools/fetch-sprites.js          # solo los que faltan
 *   node tools/fetch-sprites.js --force  # vuelve a bajarlos todos
 *
 * Igual que fetch-dataset.js, esto NO se ejecuta en el arranque ni en el build:
 * los PNG van versionados en el repo por el mismo motivo que los JSON del
 * dataset. La app es offline-first y autoalojada, así que no puede depender de
 * que GitHub conteste — ni pedirle una imagen al navegador de cada usuario.
 *
 * POR QUÉ black-white Y NO OTRA CARPETA: es la única del repo de PokeAPI que
 * cubre los 1025 de un tirón. `generation-vi/x-y` se corta en el #721 y
 * `generation-vii/ultra-sun-ultra-moon` en el #807; a partir de ahí habría que
 * encadenar carpetas y el estilo cambiaría a mitad de Pokédex. En black-white
 * los posteriores a la quinta generación traen sprite en ese mismo pixel-art,
 * así que la Pokédex entera se ve coherente. Comprobado #900 y #1025.
 *
 * Son 96x96 y ~1,3 KB de media: el conjunto pesa poco más de 1 MB.
 */

const fs = require("fs");
const path = require("path");

const BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white";
const OUT_DIR = path.join(__dirname, "..", "..", "frontend", "public", "sprites");
const CONCURRENCY = 8;
const LAST_DEX = 1025;

const force = process.argv.includes("--force");

const SHINY = `${BASE}/shiny`;
// Las formas (megas, regionales…) no existen en el estilo de la 5ª generación:
// salen del juego de sprites general de PokeAPI.
const FORMAS = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

/**
 * Todo lo que hay que tener en disco:
 *   /sprites/<dex>.png          el normal (1025)
 *   /sprites/shiny/<dex>.png    la versión variocolor (1025)
 *   /sprites/forms/<id>.png     megas, formas regionales y demás (data/forms.json)
 */
function tareas() {
  const lista = [];
  for (let dex = 1; dex <= LAST_DEX; dex++) {
    lista.push({ nombre: `#${dex}`, url: `${BASE}/${dex}.png`, destino: path.join(OUT_DIR, `${dex}.png`) });
    lista.push({
      nombre: `shiny #${dex}`,
      url: `${SHINY}/${dex}.png`,
      destino: path.join(OUT_DIR, "shiny", `${dex}.png`),
    });
  }
  const formas = path.join(__dirname, "..", "data", "forms.json");
  if (fs.existsSync(formas)) {
    for (const f of JSON.parse(fs.readFileSync(formas, "utf-8"))) {
      if (!f.sprite) continue;
      lista.push({
        nombre: `forma ${f.key}`,
        url: `${FORMAS}/${f.sprite}.png`,
        destino: path.join(OUT_DIR, "forms", `${f.sprite}.png`),
      });
    }
  }
  return lista;
}

async function bajar({ url, destino }) {
  if (!force && fs.existsSync(destino)) return "omitido";

  const res = await fetch(url);
  if (!res.ok) return `error ${res.status}`;

  const buf = Buffer.from(await res.arrayBuffer());
  // Cabecera PNG: si GitHub devuelve una página de error con 200, no la guardamos.
  if (buf.length < 8 || buf.toString("latin1", 1, 4) !== "PNG") return "no es un png";

  fs.writeFileSync(destino, buf);
  return "ok";
}

async function main() {
  fs.mkdirSync(path.join(OUT_DIR, "shiny"), { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, "forms"), { recursive: true });

  const pendientes = tareas();
  const total = pendientes.length;

  const fallos = [];
  let ok = 0;
  let omitidos = 0;
  let siguiente = 0;

  const trabajador = async () => {
    while (siguiente < pendientes.length) {
      const tarea = pendientes[siguiente++];
      try {
        const r = await bajar(tarea);
        if (r === "ok") ok++;
        else if (r === "omitido") omitidos++;
        else fallos.push(`${tarea.nombre}: ${r}`);
      } catch (err) {
        fallos.push(`${tarea.nombre}: ${err.message}`);
      }
      const hechos = ok + omitidos + fallos.length;
      if (hechos % 250 === 0) process.stdout.write(`  ${hechos}/${total}\n`);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, trabajador));

  console.log(`\n✔ ${ok} descargados, ${omitidos} ya estaban, ${fallos.length} fallidos`);
  if (fallos.length) {
    console.log(fallos.slice(0, 20).join("\n"));
    // Una forma sin sprite no es motivo para tumbar el build de Docker: la
    // ficha cae a la inicial del nombre. Que falte un sprite NORMAL sí lo es.
    if (fallos.some((f) => f.startsWith("#"))) process.exitCode = 1;
  }
}

main();
