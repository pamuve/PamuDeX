/**
 * Prueba de humo del middleware del modo Champions (Tarea 6.3), con `db`, `req`
 * y `res` simulados. No forma parte del entregable: verifica la lógica sin
 * arrancar el servidor ni SQLite.
 *
 * Es el mismo estilo que `overrides.smoke.js`, porque el middleware es el mismo
 * truco: interceptar `res.json`. Lo que se comprueba aquí es que sin
 * `?champions=` no toca nada, que filtra listados y búsqueda, que una ficha no
 * permitida se convierte en 404 y que los multiplicadores se remapean por clave.
 */

const assert = require("assert");
const championsMode = require("../middleware/championsMode");

/* ---------------------------------------------------------------- */
/* Base de datos simulada: un solo conjunto de reglas                */
/* ---------------------------------------------------------------- */

const REGLAS = {
  id: 1,
  name: "Solo iniciales",
  allowed_pokemon_json: "[1,4,7]",
  allowed_moves_json: null,
  allowed_abilities_json: "[]",
  allowed_items_json: null,
  custom_multipliers_json: null,
};

const fakeDb = {
  prepare(sql) {
    if (sql.includes("FROM champions_rules")) {
      return { get: (id) => (id === 1 ? REGLAS : undefined) };
    }
    throw new Error("consulta no simulada: " + sql);
  },
};

const middleware = championsMode(fakeDb);

/**
 * Ejecuta el middleware y devuelve `{ status, body }` tras responder `body`.
 * `query` simula la de Express.
 */
function run(path, query, body) {
  let status = 200;
  let captured;
  const res = {
    status(code) {
      status = code;
      return res;
    },
    json(payload) {
      captured = payload;
      return res;
    },
  };
  const req = { path, query };
  middleware(req, res, () => {});
  res.json(body);
  return { status, body: captured, req };
}

/* ================================================================ */
/* 1. Sin ?champions= no se toca nada                                */
/* ================================================================ */
const intacto = run("/pokemon", {}, [{ id: 1 }, { id: 99 }]);
assert.deepStrictEqual(intacto.body, [{ id: 1 }, { id: 99 }]);
console.log("1 OK  sin ?champions el cuerpo pasa intacto");

/* ================================================================ */
/* 2. Un conjunto inexistente degrada al dato global                 */
/* ================================================================ */
const inexistente = run("/pokemon", { champions: "999" }, [{ id: 1 }, { id: 99 }]);
assert.deepStrictEqual(inexistente.body, [{ id: 1 }, { id: 99 }]);
assert.deepStrictEqual(run("/pokemon", { champions: "abc" }, [{ id: 9 }]).body, [{ id: 9 }]);
console.log("2 OK  conjunto inexistente o id inválido: dato global");

/* ================================================================ */
/* 3. Listados filtrados                                             */
/* ================================================================ */
const lista = run("/pokemon", { champions: "1" }, [{ id: 1 }, { id: 2 }, { id: 4 }, { id: 25 }]);
assert.deepStrictEqual(lista.body.map((p) => p.id), [1, 4]);

// Sin restricción en movimientos, el listado sale entero.
const movimientos = run("/moves", { champions: "1" }, [{ id: 1 }, { id: 2 }]);
assert.strictEqual(movimientos.body.length, 2);

// Lista vacía = nada permitido.
assert.deepStrictEqual(run("/abilities", { champions: "1" }, [{ id: 1 }]).body, []);
console.log("3 OK  listados filtrados, incluidos «sin restricción» y «nada»");

/* ================================================================ */
/* 4. /search: se filtra el contenido, NO los tipos                  */
/* ================================================================ */
const busqueda = run(
  "/search",
  { champions: "1" },
  {
    pokemon: [{ id: 1, name_es: "Bulbasaur" }, { id: 25, name_es: "Pikachu" }],
    types: [{ id: "fuego" }],
    moves: [{ id: 6 }],
    abilities: [{ id: 3 }],
  }
);
assert.deepStrictEqual(busqueda.body.pokemon.map((p) => p.id), [1], "Pikachu no es legal");
assert.deepStrictEqual(busqueda.body.types, [{ id: "fuego" }], "los tipos no se filtran");
assert.deepStrictEqual(busqueda.body.moves, [{ id: 6 }], "sin restricción de movimientos");
assert.deepStrictEqual(busqueda.body.abilities, [], "ninguna habilidad es legal");
console.log("4 OK  /search filtra contenido y respeta los tipos");

/* ================================================================ */
/* 5. Una ficha no permitida es un 404                               */
/* ================================================================ */
const permitida = run("/pokemon/1", { champions: "1" }, { id: 1, name_es: "Bulbasaur" });
assert.strictEqual(permitida.status, 200);
assert.strictEqual(permitida.body.name_es, "Bulbasaur");

// Se comprueba el id de la RESPUESTA, no el de la URL: /api/pokemon/:id acepta
// también el nº de Pokédex.
const prohibida = run("/pokemon/25", { champions: "1" }, { id: 25, name_es: "Pikachu" });
assert.strictEqual(prohibida.status, 404);
assert.strictEqual(prohibida.body.error, "no_permitido_en_champions");
console.log("5 OK  ficha no permitida -> 404");

/* ================================================================ */
/* 6. Los tipos siguen consultándose                                 */
/* ================================================================ */
const tipo = run("/types/fuego", { champions: "1" }, { id: "fuego", ofensivo: [] });
assert.strictEqual(tipo.status, 200);
console.log("6 OK  las fichas de tipo no se bloquean");

/* ================================================================ */
/* 7. Exclusividad: ?champions gana y quita ?session                 */
/* ================================================================ */
const conAmbos = run("/pokemon", { champions: "1", session: "3" }, [{ id: 1 }, { id: 25 }]);
assert.strictEqual(conAmbos.req.query.session, undefined, "?session se descarta");
assert.deepStrictEqual(conAmbos.body.map((p) => p.id), [1]);
console.log("7 OK  Champions y sesión de ROM Hack no conviven");

/* ================================================================ */
/* 8. Multiplicadores propios: se remapean POR CLAVE                 */
/* ================================================================ */
REGLAS.custom_multipliers_json = JSON.stringify({
  hiper_eficaz: 3,
  super_eficaz: 2,
  normal: 1,
  poco_eficaz: 0.5,
  muy_poco_eficaz: 0.25,
  sin_efecto: 0,
});

const ficha = run(
  "/pokemon/1",
  { champions: "1" },
  {
    id: 1,
    efectividad: [
      { multiplier: 4, label: "HIPER EFICAZ", key: "hiper_eficaz", types: ["roca"] },
      { multiplier: 2, label: "SUPEREFICAZ", key: "super_eficaz", types: ["agua"] },
    ],
  }
);
assert.strictEqual(ficha.body.efectividad[0].multiplier, 3, "el número cambia");
assert.strictEqual(ficha.body.efectividad[0].key, "hiper_eficaz", "la clave NO cambia");
assert.strictEqual(ficha.body.efectividad[0].label, "HIPER EFICAZ", "la etiqueta tampoco");
assert.deepStrictEqual(ficha.body.efectividad[0].types, ["roca"], "y nadie cambia de grupo");
assert.strictEqual(ficha.body.efectividad[1].multiplier, 2, "lo no personalizado sigue igual");

// También en las fichas de tipo, que traen ofensivo y defensivo.
const tipoConMult = run(
  "/types/roca",
  { champions: "1" },
  {
    id: "roca",
    ofensivo: [{ multiplier: 4, label: "HIPER EFICAZ", key: "hiper_eficaz", types: ["bicho"] }],
    defensivo: [{ multiplier: 2, label: "SUPEREFICAZ", key: "super_eficaz", types: ["agua"] }],
  }
);
assert.strictEqual(tipoConMult.body.ofensivo[0].multiplier, 3);
assert.strictEqual(tipoConMult.body.defensivo[0].multiplier, 2);
console.log("8 OK  multiplicadores remapeados por clave, sin recalcular nada");

/* ================================================================ */
/* 9. Cambiar el conjunto se nota sin invalidar la caché a mano      */
/* ================================================================ */
REGLAS.allowed_pokemon_json = "[25]";
const trasEditar = run("/pokemon", { champions: "1" }, [{ id: 1 }, { id: 25 }]);
assert.deepStrictEqual(trasEditar.body.map((p) => p.id), [25], "la caché se refresca sola");
console.log("9 OK  editar el conjunto se refleja en la siguiente petición");

/* ================================================================ */
/* 10. Un cuerpo inesperado no rompe la respuesta                    */
/* ================================================================ */
assert.strictEqual(run("/pokemon/1", { champions: "1" }, null).body, null);
assert.strictEqual(run("/pokemon", { champions: "1" }, "no soy JSON").body, "no soy JSON");
assert.deepStrictEqual(
  run("/chart", { champions: "1" }, { types: [], chart: {} }).body,
  { types: [], chart: {} },
  "la tabla de tipos no es contenido: no se toca"
);
console.log("10 OK  degradación segura ante formatos inesperados");

console.log("\nTodas las pruebas pasan.");
