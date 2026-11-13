"use strict";

/**
 * PamuDeX — pruebas de humo de la Fase 9: datos extra, equipos guardados,
 * capturas y compartir un ROM Hack.
 *
 * Como `import.smoke.js`, usa SQLite en memoria y un puerto efímero: lo que se
 * comprueba es la carga real de los JSON (`db/extras.js`) y que las claves
 * naturales de un ROM Hack compartido se resuelven contra el catálogo.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");

const { populate } = require("../db/populate");
const { SCHEMA_PATH } = require("../db/paths");
const { seedLearnsets, seedEvolutions, seedForms, fillEffectsEn } = require("../db/extras");
const { jsonBody, apiErrors } = require("../lib/http");

const DATA_DIR = path.join(__dirname, "..", "data");
const leer = (archivo) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, archivo), "utf-8"));

async function main() {
  const db = new Database(":memory:");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));
  populate(db, {
    types: leer("types.json"),
    typeChart: leer("type_chart.json"),
    pokemon: leer("pokemon.json"),
    moves: leer("moves.json"),
    abilities: leer("abilities.json"),
    items: leer("items.json"),
  });

  /* -------------------------------------------------------------- */
  // 1. Los datos extra se cargan enteros y no se duplican al repetir.
  {
    const n = { l: seedLearnsets(db), e: seedEvolutions(db), f: seedForms(db), en: fillEffectsEn(db) };
    assert.ok(n.l > 90000, `movimientos por Pokémon: ${n.l}`);
    assert.ok(n.e > 400, `evoluciones: ${n.e}`);
    assert.ok(n.f > 150, `formas: ${n.f}`);
    assert.ok(n.en > 2000, `efectos en inglés: ${n.en}`);
    assert.strictEqual(seedLearnsets(db), 0, "repetir la carga no inserta nada");
    assert.strictEqual(fillEffectsEn(db), 0, "ni pisa un effect_en ya puesto");

    const sin = db
      .prepare("SELECT COUNT(*) AS c FROM pokemon p WHERE NOT EXISTS (SELECT 1 FROM pokemon_moves m WHERE m.pokemon_id = p.id)")
      .get().c;
    assert.strictEqual(sin, 0, "todos los Pokémon tienen algún movimiento");
    console.log("✔ Los datos extra se cargan enteros y la carga es idempotente");
  }

  db.prepare("INSERT INTO profiles (name) VALUES ('Prueba')").run();

  const app = express();
  app.use(jsonBody());
  app.use("/api/pokemon", require("../routes/pokemon")(db));
  app.use("/api/sessions", require("../routes/sessions")(db));
  app.use("/api/extra", require("../routes/extra")(db));
  app.use("/api/teams", require("../routes/teams")(db));
  app.use("/api/captures", require("../routes/captures")(db));
  app.use(apiErrors);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const pedir = async (metodo, ruta, cuerpo) => {
    const res = await fetch(base + ruta, {
      method: metodo,
      headers: cuerpo === undefined ? {} : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return { status: res.status, body: await res.json() };
  };
  const idDe = (dex) => db.prepare("SELECT id FROM pokemon WHERE dex = ?").get(dex).id;

  try {
    /* ------------------------------------------------------------ */
    // 2. /api/extra: familia entera desde cualquier miembro, formas y movimientos.
    {
      const eevee = idDe(133);
      const desdeHijo = await pedir("GET", `/extra/pokemon/${idDe(134)}`);
      assert.strictEqual(desdeHijo.body.evolutions.root, eevee, "desde Vaporeon se sube hasta Eevee");
      assert.strictEqual(desdeHijo.body.evolutions.edges.length, 8, "y se baja por las ocho ramas");

      const charizard = await pedir("GET", `/extra/pokemon/${idDe(6)}`);
      assert.strictEqual(charizard.body.evolutions.edges.length, 2, "Charmander → Charmeleon → Charizard");
      assert.deepStrictEqual(charizard.body.forms.map((f) => f.kind), ["mega", "mega"]);
      assert.deepStrictEqual(charizard.body.forms[0].types, ["fuego", "dragon"]);
      assert.ok(charizard.body.moves.some((m) => m.method === "level" && m.level > 1));

      const rayo = db.prepare("SELECT id FROM moves WHERE name_en = 'Thunderbolt'").get().id;
      const quien = await pedir("GET", `/extra/move/${rayo}`);
      assert.ok(quien.body.pokemon.some((p) => p.pokemon_id === idDe(25)), "Pikachu aprende Rayo");
      assert.strictEqual((await pedir("GET", "/extra/pokemon/999999")).status, 404);
      console.log("✔ /api/extra devuelve la familia entera, las formas y los movimientos");
    }

    /* ------------------------------------------------------------ */
    // 3. El listado lleva tipos y stats con la forma que espera el filtro.
    {
      const lista = (await pedir("GET", "/pokemon")).body;
      assert.deepStrictEqual(lista[0].types, ["planta", "veneno"]);
      assert.deepStrictEqual(Object.keys(lista[0].stats), ["hp", "atk", "def", "spa", "spd", "spe"]);
      console.log("✔ El listado de Pokémon lleva tipos y stats");
    }

    /* ------------------------------------------------------------ */
    // 4. Capturas: por perfil Y por ámbito, alta idempotente.
    {
      const enHack = "/captures?profile=1&scope=session:7";
      assert.strictEqual((await pedir("POST", enHack, { pokemon_id: 25 })).body.cambiado, true);
      assert.strictEqual((await pedir("POST", enHack, { pokemon_id: 25 })).body.cambiado, false, "dos veces no duplica");
      assert.deepStrictEqual((await pedir("GET", enHack)).body.pokemon, [25]);
      assert.deepStrictEqual((await pedir("GET", "/captures?profile=1")).body.pokemon, [], "otro juego, otra partida");
      assert.strictEqual((await pedir("GET", "/captures?profile=1&scope=cualquiera")).status, 400);
      assert.strictEqual((await pedir("GET", "/captures?profile=99")).status, 404);
      await pedir("DELETE", enHack, { pokemon_id: 25 });
      assert.deepStrictEqual((await pedir("GET", enHack)).body.pokemon, []);
      console.log("✔ Las capturas son por perfil y por juego");
    }

    /* ------------------------------------------------------------ */
    // 5. Equipos guardados: ciclo completo y aislados por ámbito y por perfil.
    {
      const datos = { own: { slots: [{ pokemonId: 25, moveIds: [1] }] }, rival: { slots: [] } };
      const creado = await pedir("POST", "/teams?profile=1&scope=champions:2", { name: "  Lluvia  ", data: datos });
      assert.strictEqual(creado.status, 201);
      assert.strictEqual(creado.body.name, "Lluvia");
      assert.strictEqual((await pedir("GET", "/teams?profile=1&scope=champions:2")).body.items.length, 1);
      assert.strictEqual((await pedir("GET", "/teams?profile=1")).body.items.length, 0, "no aparece en otro juego");
      assert.deepStrictEqual((await pedir("GET", `/teams/${creado.body.id}?profile=1`)).body.data, datos);
      assert.strictEqual((await pedir("POST", "/teams?profile=1", { name: "x", data: [] })).status, 400, "data debe ser un objeto");

      db.prepare("INSERT INTO profiles (name) VALUES ('Otro')").run();
      assert.strictEqual((await pedir("GET", `/teams/${creado.body.id}?profile=2`)).status, 404, "otro perfil no lo ve");
      assert.strictEqual((await pedir("DELETE", `/teams/${creado.body.id}?profile=2`)).status, 404, "ni lo puede borrar");
      assert.strictEqual((await pedir("DELETE", `/teams/${creado.body.id}?profile=1`)).status, 200);
      console.log("✔ Los equipos guardados se aíslan por perfil y por juego");
    }

    /* ------------------------------------------------------------ */
    // 6. Compartir un ROM Hack: sale por clave natural y vuelve a ids.
    {
      const pikachu = idDe(25);
      const mov = db.prepare("SELECT id, name_en FROM moves ORDER BY id LIMIT 1").get();
      const data = {
        pokemon: { [pikachu]: { stats: { hp: 99 } } },
        moves: { [mov.id]: { power: 1 } },
        relations: { fuego: { agua: 2 } },
        options: { any_move: true },
      };
      const sesion = await pedir("POST", "/sessions", { name: "Mi hack", data_json: data });
      const compartido = (await pedir("GET", `/sessions/${sesion.body.id}/share`)).body;

      assert.strictEqual(compartido.format, "pamudex-romhack");
      assert.deepStrictEqual(Object.keys(compartido.data.pokemon), ["25"], "el Pokémon va por nº de Pokédex");
      assert.deepStrictEqual(Object.keys(compartido.data.moves), [mov.name_en], "el movimiento, por nombre en inglés");
      assert.deepStrictEqual(compartido.data.options, { any_move: true }, "las opciones viajan tal cual");

      // Se añade algo que esta instalación no tiene: debe omitirse y contarse.
      compartido.data.moves["Movimiento Que No Existe"] = { power: 5 };
      const importado = await pedir("POST", "/sessions/import", compartido);
      assert.strictEqual(importado.status, 201);
      assert.strictEqual(importado.body.name, "Mi hack (2)", "nunca pisa una sesión existente");
      assert.strictEqual(importado.body.skipped, 1);
      assert.deepStrictEqual(JSON.parse(importado.body.data_json), data, "los overrides vuelven a sus ids");

      assert.strictEqual((await pedir("POST", "/sessions/import", { format: "otra-cosa" })).status, 400);
      console.log("✔ Un ROM Hack compartido viaja por clave natural y se importa como sesión nueva");
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }

  console.log("\nTodas las pruebas de la Fase 9 han pasado.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
