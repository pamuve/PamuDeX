"use strict";

/**
 * PamuDeX — pruebas de humo de la importación global.
 *
 * A diferencia de las demás, esta SÍ usa SQLite (en memoria) y un servidor en
 * un puerto efímero. Lo que comprueba es justo lo que una base simulada no
 * puede reproducir: cómo reparte los ids el AUTOINCREMENT después de vaciar una
 * tabla. No toca el disco ni la base real.
 *
 * EL FALLO QUE CUBRE
 * ------------------
 * La importación global vacía el catálogo y lo vuelve a volcar. SQLite no
 * reutiliza un id de una tabla AUTOINCREMENT, así que reimportar la propia
 * exportación dejaba a Bulbasaur en el id 1026 y a cada movimiento y habilidad
 * con id nuevo. Favoritos, historial, overrides de sesión, listas de Champions
 * y el equipo guardado referencian ids internos y quedaban huérfanos.
 *
 * También cubre los dos fallos del cuerpo de las peticiones: una sesión con
 * muchos overrides superaba el límite de 100 KB de `express.json` y no se podía
 * guardar, y un error de ese tipo salía como página HTML en vez de JSON.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");

const { populate } = require("../db/populate");
const { SCHEMA_PATH } = require("../db/paths");
const { jsonBody, apiErrors } = require("../lib/http");

const DATA_DIR = path.join(__dirname, "..", "data");
const leer = (archivo) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, archivo), "utf-8"));

function crearApp() {
  const db = new Database(":memory:");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));
  populate(db, {
    types: leer("types.json"),
    typeChart: leer("type_chart.json"),
    pokemon: leer("pokemon.json"),
    moves: leer("moves.json"),
    abilities: leer("abilities.json"),
    items: [],
  });

  const app = express();
  app.use(jsonBody());
  app.use("/api/sessions", require("../routes/sessions")(db));
  app.use("/api/export", require("../routes/export")(db));
  app.use("/api/import", require("../routes/import")(db));
  app.use("/api/search", require("../routes/search")(db));
  app.use(apiErrors);
  return { app, db };
}

/** Los ids actuales por clave natural, que es lo que no debe moverse. */
function fotoDeIds(db) {
  const mapa = (sql) => new Map(db.prepare(sql).all().map((r) => [String(r.k), r.id]));
  return {
    pokemon: mapa("SELECT dex AS k, id FROM pokemon"),
    moves: mapa("SELECT name_en AS k, id FROM moves"),
    abilities: mapa("SELECT name_en AS k, id FROM abilities"),
  };
}

function mismosIds(antes, despues, entidad) {
  for (const [clave, id] of antes[entidad]) {
    if (!despues[entidad].has(clave)) continue; // lo que se quitó no cuenta
    assert.strictEqual(
      despues[entidad].get(clave),
      id,
      `${entidad} «${clave}» ha cambiado de id: ${id} -> ${despues[entidad].get(clave)}`
    );
  }
}

async function main() {
  const { app, db } = crearApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const importar = (dataset, mode) =>
    fetch(`${base}/import/apply?target=global&mode=${mode}&format=json`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: JSON.stringify(dataset),
    });

  try {
    const antes = fotoDeIds(db);
    const exportado = await (await fetch(`${base}/export/json`)).json();

    /* ------------------------------------------------------------ */
    // 1. Reimportar la propia exportación no mueve ni un id.
    {
      const res = await importar(exportado, "merge");
      assert.strictEqual(res.status, 200, "la importación global debe aceptarse");
      const despues = fotoDeIds(db);
      for (const entidad of ["pokemon", "moves", "abilities"]) {
        assert.strictEqual(despues[entidad].size, antes[entidad].size, `${entidad}: mismo número de filas`);
        mismosIds(antes, despues, entidad);
      }
      console.log("✔ Reimportar la exportación conserva todos los ids internos");
    }

    /* ------------------------------------------------------------ */
    // 2. En modo `replace`, lo nuevo recibe id nuevo y lo que sigue conserva el suyo.
    {
      const maxAntes = Math.max(...antes.moves.values());
      const dataset = {
        ...exportado,
        pokemon: exportado.pokemon.filter((p) => p.dex !== 2),
        moves: [...exportado.moves, { ...exportado.moves[0], name_es: "Prueba Nueva", name_en: "Brand New Test" }],
      };
      const res = await importar(dataset, "replace");
      assert.strictEqual(res.status, 200);
      const despues = fotoDeIds(db);

      assert.ok(!despues.pokemon.has("2"), "el Pokémon retirado ya no está");
      mismosIds(antes, despues, "pokemon");
      mismosIds(antes, despues, "moves");
      mismosIds(antes, despues, "abilities");
      assert.ok(
        despues.moves.get("Brand New Test") > maxAntes,
        "el movimiento nuevo recibe un id por encima de los existentes"
      );
      // Las tablas de relación siguen apuntando a filas que existen.
      const huerfanos = db
        .prepare(
          `SELECT COUNT(*) AS c FROM pokemon_abilities pa
            WHERE NOT EXISTS (SELECT 1 FROM abilities a WHERE a.id = pa.ability_id)
               OR NOT EXISTS (SELECT 1 FROM pokemon p WHERE p.id = pa.pokemon_id)`
        )
        .get().c;
      assert.strictEqual(huerfanos, 0, "no quedan habilidades de Pokémon huérfanas");
      console.log("✔ En modo replace lo nuevo recibe id nuevo y lo demás conserva el suyo");
    }

    /* ------------------------------------------------------------ */
    // 3. Una sesión con muchos overrides (un ROM Hack que toca todo) se guarda.
    {
      const creada = await (
        await fetch(`${base}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Hack grande" }),
        })
      ).json();

      const pokemon = {};
      for (let i = 1; i <= 1025; i++) {
        pokemon[i] = {
          stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
          types: [{ id: "fuego", name_es: "Fuego", name_en: "Fire", color: "#F08030" }],
        };
      }
      const cuerpo = JSON.stringify({ data: { pokemon } });
      assert.ok(cuerpo.length > 100 * 1024, "el caso debe superar el límite antiguo de 100 KB");

      const res = await fetch(`${base}/sessions/${creada.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: cuerpo,
      });
      assert.strictEqual(res.status, 200, "una sesión grande debe poder guardarse");
      console.log("✔ Una sesión con overrides para todo el catálogo se guarda");
    }

    /* ------------------------------------------------------------ */
    // 4. Los errores del cuerpo salen en JSON, no como página HTML con la traza.
    {
      const res = await fetch(`${base}/sessions/1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "{esto no es json",
      });
      assert.strictEqual(res.status, 400);
      assert.match(res.headers.get("content-type"), /application\/json/);
      assert.deepStrictEqual(await res.json(), { error: "json_invalido" });
      console.log("✔ Un cuerpo mal formado responde 400 en JSON");
    }

    /* ------------------------------------------------------------ */
    // 5. El buscador no se cae con una query rara ni trata % como comodín.
    {
      const lista = await fetch(`${base}/search?q[]=a`);
      assert.strictEqual(lista.status, 200, "?q[]= no debe dar un 500");
      assert.deepStrictEqual(await lista.json(), { pokemon: [], types: [], moves: [], abilities: [] });

      const comodin = await (await fetch(`${base}/search?q=%25%25`)).json();
      assert.strictEqual(comodin.pokemon.length, 0, "«%%» no es un comodín que lo encuentra todo");

      const normal = await (await fetch(`${base}/search?q=bulba`)).json();
      assert.strictEqual(normal.pokemon[0].name_en, "Bulbasaur");
      console.log("✔ El buscador aguanta queries raras y escapa los comodines");
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }

  console.log("\nTodas las pruebas de importación y de la capa HTTP han pasado.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
