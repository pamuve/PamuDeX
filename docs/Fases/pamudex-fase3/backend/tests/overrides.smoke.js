/**
 * Prueba de humo del middleware de overrides, con `db`, `req` y `res` simulados.
 * No forma parte del entregable: sirve para verificar la lógica sin arrancar
 * el servidor ni SQLite.
 */

const assert = require("assert");
const sessionOverrides = require("../middleware/sessionOverrides");
const { applyOverrides } = require("../lib/overrides");
const { buildChart, defensiveMultiplier } = require("../lib/typechart");

const DATA = {
  pokemon: { 25: { stats: { spe: 120 }, types: ["electrico", "hada"] } },
  relations: { fuego: { agua: 2 } },
};

const fakeDb = {
  prepare(sql) {
    if (sql.includes("FROM sessions")) {
      return { get: () => ({ data_json: JSON.stringify(DATA) }) };
    }
    if (sql.includes("FROM types")) {
      return {
        all: () => [
          { id: "electrico", name_es: "Eléctrico", name_en: "Electric" },
          { id: "hada", name_es: "Hada", name_en: "Fairy" },
          { id: "tierra", name_es: "Tierra", name_en: "Ground" },
          { id: "veneno", name_es: "Veneno", name_en: "Poison" },
          { id: "dragon", name_es: "Dragón", name_en: "Dragon" },
          { id: "acero", name_es: "Acero", name_en: "Steel" },
        ],
      };
    }
    if (sql.includes("FROM relations")) {
      return { get: () => null, all: () => [] };
    }
    throw new Error("consulta no simulada: " + sql);
  },
};

function run(path, query, body) {
  const middleware = sessionOverrides(fakeDb);
  let captured;
  const res = { json: (payload) => (captured = payload) };
  middleware({ path, query }, res, () => {});
  res.json(body);
  return captured;
}

/* 1. Merge de un nivel: cambiar spe no borra el resto de stats ---------------- */
const merged = applyOverrides(
  { stats: { hp: 35, atk: 55, spe: 90 }, name_es: "Pikachu" },
  { stats: { spe: 120 } }
);
assert.deepStrictEqual(merged.stats, { hp: 35, atk: 55, spe: 120 });
assert.strictEqual(merged.name_es, "Pikachu");
console.log("1 OK  merge superficial + un nivel en stats");

/* 2. Sin ?session la respuesta no se toca ------------------------------------ */
const untouched = run("/pokemon/25", {}, { id: 25, stats: { spe: 90 } });
assert.deepStrictEqual(untouched, { id: 25, stats: { spe: 90 } });
console.log("2 OK  sin ?session el cuerpo pasa intacto");

/* 3. Pikachu Eléctrico/Hada: tipos rehidratados y efectividad recalculada ----- */
const pikachu = run(
  "/pokemon/25",
  { session: "1" },
  {
    id: 25,
    name_es: "Pikachu",
    stats: { hp: 35, atk: 55, spe: 90 },
    types: [{ id: "electrico", name_es: "Eléctrico", color: "#F7D02C" }],
    efectividad: [
      { multiplier: 2, label: "SUPEREFICAZ", key: "supereficaz", types: ["tierra"] },
      { multiplier: 0.5, label: "POCO EFICAZ", key: "poco_eficaz", types: ["volador", "acero", "electrico"] },
    ],
  }
);

assert.strictEqual(pikachu.stats.spe, 120);
assert.strictEqual(pikachu.stats.hp, 35);
assert.deepStrictEqual(pikachu.types.map((t) => t.id), ["electrico", "hada"]);
assert.strictEqual(pikachu.types[1].name_es, "Hada");

const grupo = (m) => pikachu.efectividad.find((g) => g.multiplier === m);
// Eléctrico/Hada: Veneno x2 (neutro vs eléctrico, x2 vs hada), Tierra x2, Acero x2
assert.ok(grupo(2).types.includes("veneno"), "Veneno debería ser supereficaz");
assert.ok(grupo(2).types.includes("tierra"), "Tierra debería ser supereficaz");
// Dragón x0 gracias al tipo Hada
assert.ok(grupo(0) && grupo(0).types.includes("dragon"), "Dragón debería ser inmune");
assert.strictEqual(grupo(2).label, "SUPEREFICAZ", "conserva la etiqueta original");
console.log("3 OK  tipos rehidratados + efectividad recalculada");

/* 4. Override de relaciones: Fuego -> Agua pasa a x2 ------------------------- */
const chart = buildChart(fakeDb, DATA.relations);
assert.strictEqual(chart.fuego.agua, 2);
assert.strictEqual(chart.agua.fuego, 2, "el resto de la tabla no cambia");
assert.strictEqual(defensiveMultiplier(chart, "tierra", ["electrico", "hada"]), 2);
console.log("4 OK  override de relaciones aplicado");

/* 5. Listados y /search ------------------------------------------------------ */
const lista = run("/pokemon", { session: "1" }, [{ id: 25, name_es: "Pikachu" }, { id: 6, name_es: "Charizard" }]);
assert.strictEqual(lista[0].stats.spe, 120);
assert.strictEqual(lista[1].name_es, "Charizard");

const busqueda = run("/search", { session: "1" }, { pokemon: [{ id: 25, name_es: "Pikachu" }], types: [], moves: [], abilities: [] });
assert.strictEqual(busqueda.pokemon[0].stats.spe, 120);
console.log("5 OK  listados y /search");

/* 6. Un cuerpo inesperado no rompe la respuesta ------------------------------ */
const raro = run("/pokemon/25", { session: "1" }, { id: 25, efectividad: "esto no es un array" });
assert.strictEqual(raro.efectividad, "esto no es un array");
console.log("6 OK  degradación segura ante formatos inesperados");

console.log("\nTodas las pruebas pasan.");
