/**
 * Descarga los sprites de los 1025 Pokémon a frontend/public/sprites/<dex>.png.
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

async function bajar(dex) {
  const destino = path.join(OUT_DIR, `${dex}.png`);
  if (!force && fs.existsSync(destino)) return "omitido";

  const res = await fetch(`${BASE}/${dex}.png`);
  if (!res.ok) return `error ${res.status}`;

  const buf = Buffer.from(await res.arrayBuffer());
  // Un PNG válido empieza por \x89PNG. Si GitHub devuelve una página de error
  // con código 200, esto lo caza antes de dejar basura en el repo.
  if (buf.length < 8 || buf.toString("latin1", 1, 4) !== "PNG") return "no es un png";

  fs.writeFileSync(destino, buf);
  return "ok";
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const pendientes = [];
  for (let dex = 1; dex <= LAST_DEX; dex++) pendientes.push(dex);

  const fallos = [];
  let ok = 0;
  let omitidos = 0;
  let siguiente = 0;

  // Un pool de CONCURRENCY tareas que van tomando el siguiente número libre.
  // 1025 peticiones a la vez es una forma rápida de que te corten.
  const trabajador = async () => {
    while (siguiente < pendientes.length) {
      const dex = pendientes[siguiente++];
      try {
        const r = await bajar(dex);
        if (r === "ok") ok++;
        else if (r === "omitido") omitidos++;
        else fallos.push(`#${dex}: ${r}`);
      } catch (err) {
        fallos.push(`#${dex}: ${err.message}`);
      }
      const hechos = ok + omitidos + fallos.length;
      if (hechos % 100 === 0) process.stdout.write(`  ${hechos}/${LAST_DEX}\n`);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, trabajador));

  console.log(`\n✔ ${ok} descargados, ${omitidos} ya estaban, ${fallos.length} fallidos`);
  if (fallos.length) {
    console.log(fallos.slice(0, 20).join("\n"));
    process.exitCode = 1;
  }
}

main();
