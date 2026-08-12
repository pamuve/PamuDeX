/**
 * Prueba de humo del filtrado de Pokémon Champions (Tarea 6.1), con `db`, `req`
 * y `res` simulados. No forma parte del entregable: verifica la lógica sin
 * arrancar el servidor ni SQLite.
 *
 * Lo que de verdad se comprueba aquí es la distinción entre **NULL** (sin
 * restricción) y **lista vacía** (nada permitido), que es la decisión de diseño
 * de la tarea y la que más fácil sería romper sin darse cuenta.
 */

const assert = require("assert");
const championsRoute = require("../routes/champions");
const {
  parseAllowed,
  serializeAllowed,
  allows,
  filterList,
  readRules,
} = require("../lib/championsFilter");
const {
  createEffectiveness,
  normalizeMultipliers,
  categoryOf,
  DEFAULT_MULTIPLIERS,
} = require("../lib/effectiveness");

/* ---------------------------------------------------------------- */
/* 1. NULL no es lo mismo que lista vacía                            */
/* ---------------------------------------------------------------- */
assert.strictEqual(parseAllowed(null), null, "NULL = sin restricción");
assert.strictEqual(parseAllowed(undefined), null);
assert.strictEqual(parseAllowed(""), null);
assert.strictEqual(parseAllowed("[]").size, 0, "[] = nada permitido");
assert.strictEqual(parseAllowed("[1,2,3]").size, 3);

const CATALOGO = [{ id: 1 }, { id: 2 }, { id: 3 }];
assert.deepStrictEqual(filterList(CATALOGO, null), CATALOGO, "sin restricción pasa todo");
assert.deepStrictEqual(filterList(CATALOGO, parseAllowed("[]")), [], "lista vacía no pasa nada");
assert.deepStrictEqual(filterList(CATALOGO, parseAllowed("[2]")), [{ id: 2 }]);

assert.strictEqual(allows(null, 999), true);
assert.strictEqual(allows(parseAllowed("[7]"), 7), true);
assert.strictEqual(allows(parseAllowed("[7]"), "7"), true, "el id vale como número o cadena");
assert.strictEqual(allows(parseAllowed("[7]"), 8), false);
console.log("1 OK  NULL = sin restricción, [] = nada permitido");

/* ---------------------------------------------------------------- */
/* 2. Normalización al guardar                                       */
/* ---------------------------------------------------------------- */
assert.deepStrictEqual(serializeAllowed(null), { ok: true, json: null });
assert.deepStrictEqual(serializeAllowed([]), { ok: true, json: "[]" });
// Ordena y quita repetidos: marcar en otro orden no debe cambiar lo guardado.
assert.deepStrictEqual(serializeAllowed([3, 1, 2, 1]), { ok: true, json: "[1,2,3]" });
assert.deepStrictEqual(serializeAllowed(["4", 2]), { ok: true, json: "[2,4]" });
assert.strictEqual(serializeAllowed("no soy una lista").ok, false);
assert.strictEqual(serializeAllowed([0]).ok, false, "los ids son enteros positivos");
assert.strictEqual(serializeAllowed([-1]).ok, false);
assert.strictEqual(serializeAllowed(["abc"]).ok, false);
assert.strictEqual(serializeAllowed(new Array(5001).fill(1)).error, "lista_demasiado_larga");
console.log("2 OK  ids normalizados, ordenados y validados");

/* ---------------------------------------------------------------- */
/* 3. Un JSON corrupto no deja el modo sin contenido                 */
/* ---------------------------------------------------------------- */
assert.strictEqual(parseAllowed("{esto no es JSON"), null);
assert.strictEqual(parseAllowed('{"no":"es un array"}'), null);
console.log("3 OK  JSON corrupto degrada a «sin restricción»");

/* ---------------------------------------------------------------- */
/* 4. readRules: forma de la respuesta                               */
/* ---------------------------------------------------------------- */
const reglas = readRules({
  id: 1,
  name: "Champions básico",
  allowed_pokemon_json: "[3,1,2]",
  allowed_moves_json: null,
  allowed_abilities_json: "[]",
  allowed_items_json: null,
  custom_multipliers_json: '{"hiper_eficaz":4}',
});
assert.deepStrictEqual(reglas.allowed.pokemon, [1, 2, 3]);
assert.strictEqual(reglas.allowed.moves, null, "sin restricción viaja como null");
assert.deepStrictEqual(reglas.allowed.abilities, []);
assert.strictEqual(reglas.counts.pokemon, 3);
assert.strictEqual(reglas.counts.moves, null);
assert.strictEqual(reglas.counts.abilities, 0);
// La tabla sale siempre completa, para que el frontend no conozca las
// constantes del proyecto; `multipliers_custom` dice si se aparta de ellas.
assert.deepStrictEqual(reglas.multipliers, DEFAULT_MULTIPLIERS);
assert.strictEqual(reglas.multipliers_custom, false, "x4 es el valor de siempre");
console.log("4 OK  readRules distingue null, [] y lista con ids");

/* ================================================================ */
/* Ruta completa con db simulada                                     */
/* ================================================================ */

const POKEMON = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  dex: i + 1,
  name_es: `Pokémon ${i + 1}`,
  name_en: `Pokemon ${i + 1}`,
  generation: 1,
  hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50,
  height_m: 1, weight_kg: 10,
}));

const TIPOS = [
  { id: "fuego", name_es: "Fuego", name_en: "Fire", color: "#F08030" },
  { id: "agua", name_es: "Agua", name_en: "Water", color: "#6890F0" },
  { id: "planta", name_es: "Planta", name_en: "Grass", color: "#78C850" },
];

/**
 * Tabla de tipos mínima pero suficiente para que salgan las tres categorías
 * que hacen falta: x2 (super), x0.5 (poco) y x1 (normal).
 */
const RELACIONES = {
  fuego: { planta: 2, agua: 0.5, fuego: 0.5 },
  agua: { fuego: 2, planta: 0.5, agua: 0.5 },
  planta: { agua: 2, fuego: 0.5, planta: 0.5 },
};

/** El Pokémon 1 es de tipo planta: recibe x2 de fuego y x0.5 de agua. */
const TIPOS_DE = { 1: ["planta"] };

let filas = [];
let nextId = 1;

const fakeDb = {
  transaction: (fn) => (...args) => fn(...args),
  prepare(sql) {
    if (sql.includes("INSERT INTO champions_rules")) {
      return {
        run: (name) => {
          const fila = {
            id: nextId++,
            name,
            allowed_pokemon_json: null,
            allowed_moves_json: null,
            allowed_abilities_json: null,
            allowed_items_json: null,
            custom_multipliers_json: null,
          };
          filas.push(fila);
          return { lastInsertRowid: fila.id, changes: 1 };
        },
      };
    }
    if (sql.includes("UPDATE champions_rules SET name")) {
      return {
        run: (name, id) => {
          const fila = filas.find((f) => f.id === id);
          if (fila) fila.name = name;
          return { changes: fila ? 1 : 0 };
        },
      };
    }
    const update = /UPDATE champions_rules SET (allowed_\w+_json)/.exec(sql);
    if (update) {
      return {
        run: (json, id) => {
          const fila = filas.find((f) => f.id === id);
          if (fila) fila[update[1]] = json;
          return { changes: fila ? 1 : 0 };
        },
      };
    }
    if (sql.includes("DELETE FROM champions_rules")) {
      return {
        run: (id) => {
          const antes = filas.length;
          filas = filas.filter((f) => f.id !== id);
          return { changes: antes - filas.length };
        },
      };
    }
    if (sql.includes("UPDATE champions_rules SET custom_multipliers_json")) {
      return {
        run: (json, id) => {
          const fila = filas.find((f) => f.id === id);
          if (fila) fila.custom_multipliers_json = json;
          return { changes: fila ? 1 : 0 };
        },
      };
    }
    if (sql.includes("FROM champions_rules") && sql.includes("WHERE id = ?")) {
      return { get: (id) => filas.find((f) => f.id === id) };
    }
    if (sql.includes("FROM champions_rules")) return { all: () => filas };

    /* --- tabla de tipos (la usa el motor de efectividad) ------------- */
    if (sql.includes("FROM relations")) {
      return {
        get: (atacante, defensor) => {
          const fila = RELACIONES[atacante];
          const valor = fila ? fila[defensor] : undefined;
          return valor === undefined ? undefined : { multiplier: valor };
        },
      };
    }

    /* --- catálogo ---------------------------------------------------- */
    if (sql.includes("FROM pokemon_types")) {
      return {
        all: (pokemonId) =>
          (TIPOS_DE[pokemonId] || []).map((id) => TIPOS.find((t) => t.id === id)),
      };
    }
    if (sql.includes("FROM pokemon_abilities")) return { all: () => [] };
    if (sql.includes("FROM pokemon") && sql.includes("OR dex = ?")) {
      return { get: (id) => POKEMON.find((p) => String(p.id) === String(id)) };
    }
    if (sql.includes("FROM pokemon")) return { all: () => POKEMON };
    if (sql.includes("FROM types") && sql.includes("WHERE id = ?")) {
      return { get: (id) => TIPOS.find((t) => t.id === id) };
    }
    if (sql.includes("FROM types")) return { all: () => TIPOS };
    if (sql.includes("FROM moves")) return { all: () => [] };
    if (sql.includes("FROM abilities")) return { all: () => [] };
    if (sql.includes("FROM items")) return { all: () => [] };

    throw new Error("consulta no simulada: " + sql);
  },
};

const champions = championsRoute(fakeDb);

function pedir(method, url, { params = {}, body } = {}) {
  let status = 200;
  let payload;
  const res = {
    status(code) {
      status = code;
      return res;
    },
    json(data) {
      payload = data;
      return res;
    },
  };
  champions({ method, url, originalUrl: url, query: {}, params, body, headers: {} }, res, (err) => {
    throw err || new Error(`ninguna ruta atendió ${method} ${url}`);
  });
  return { status, body: payload };
}

/* ---------------------------------------------------------------- */
/* 5. Un conjunto recién creado permite TODO                         */
/* ---------------------------------------------------------------- */
let r = pedir("POST", "/", { body: { name: "Champions básico" } });
assert.strictEqual(r.status, 201);
assert.strictEqual(r.body.allowed.pokemon, null);

const id = r.body.id;
r = pedir("GET", `/${id}/pokemon`, { params: { id: String(id) } });
assert.strictEqual(r.body.length, 20, "sin restricción se ve el catálogo entero");
console.log("5 OK  un conjunto nuevo no deja el modo vacío");

/* ---------------------------------------------------------------- */
/* 6. El criterio de aceptación: 10 permitidos -> 10 devueltos       */
/* ---------------------------------------------------------------- */
const diez = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
r = pedir("PUT", `/${id}`, { params: { id: String(id) }, body: { allowed: { pokemon: diez } } });
assert.strictEqual(r.status, 200);
assert.deepStrictEqual(r.body.allowed.pokemon, diez);
assert.strictEqual(r.body.counts.pokemon, 10);

r = pedir("GET", `/${id}/pokemon`, { params: { id: String(id) } });
assert.strictEqual(r.body.length, 10);
assert.deepStrictEqual(r.body.map((p) => p.id), diez);
console.log("6 OK  10 Pokémon permitidos -> el listado devuelve esos 10");

/* ---------------------------------------------------------------- */
/* 7. PUT es parcial y no pisa las demás entidades                   */
/* ---------------------------------------------------------------- */
r = pedir("PUT", `/${id}`, { params: { id: String(id) }, body: { name: "Champions 2026" } });
assert.strictEqual(r.body.name, "Champions 2026");
assert.deepStrictEqual(r.body.allowed.pokemon, diez, "renombrar no toca lo permitido");

r = pedir("PUT", `/${id}`, { params: { id: String(id) }, body: { allowed: { moves: [] } } });
assert.deepStrictEqual(r.body.allowed.moves, [], "[] = ningún movimiento legal");
assert.deepStrictEqual(r.body.allowed.pokemon, diez, "los Pokémon siguen igual");

// Volver a null quita la restricción.
r = pedir("PUT", `/${id}`, { params: { id: String(id) }, body: { allowed: { pokemon: null } } });
assert.strictEqual(r.body.allowed.pokemon, null);
r = pedir("GET", `/${id}/pokemon`, { params: { id: String(id) } });
assert.strictEqual(r.body.length, 20, "sin restricción vuelve el catálogo entero");
console.log("7 OK  PUT parcial: cada entidad se restringe por su cuenta");

/* ---------------------------------------------------------------- */
/* 8. Validación y errores                                           */
/* ---------------------------------------------------------------- */
assert.strictEqual(pedir("POST", "/", { body: {} }).status, 400);
assert.strictEqual(pedir("GET", "/999", { params: { id: "999" } }).status, 404);
assert.strictEqual(pedir("GET", "/abc", { params: { id: "abc" } }).status, 400);

r = pedir("PUT", `/${id}`, { params: { id: String(id) }, body: { allowed: { tipos: [1] } } });
assert.strictEqual(r.body.error, "entidad_invalida", "solo pokemon/moves/abilities/items");

r = pedir("PUT", `/${id}`, { params: { id: String(id) }, body: { allowed: { pokemon: [0] } } });
assert.strictEqual(r.body.error, "id_invalido");

// Y tras un cuerpo inválido, el conjunto no se ha quedado a medias.
r = pedir("GET", `/${id}`, { params: { id: String(id) } });
assert.strictEqual(r.body.name, "Champions 2026");
assert.deepStrictEqual(r.body.allowed.moves, []);
console.log("8 OK  validación previa: un cuerpo inválido no deja el conjunto a medias");

/* ---------------------------------------------------------------- */
/* 9. Listado y borrado                                              */
/* ---------------------------------------------------------------- */
pedir("POST", "/", { body: { name: "Solo iniciales" } });
r = pedir("GET", "/");
assert.strictEqual(r.body.length, 2);
assert.ok(!("allowed" in r.body[0]), "el listado no arrastra miles de ids");
assert.strictEqual(r.body[0].counts.moves, 0);

assert.strictEqual(pedir("DELETE", `/${id}`, { params: { id: String(id) } }).body.ok, true);
assert.strictEqual(pedir("DELETE", `/${id}`, { params: { id: String(id) } }).status, 404);
assert.strictEqual(pedir("GET", "/").body.length, 1);
console.log("9 OK  listado con recuentos y borrado idempotente en el 404");

/* ================================================================ */
/* Multiplicadores propios del modo (Tarea 6.2)                      */
/* ================================================================ */

/* ---------------------------------------------------------------- */
/* 10. La categoría la decide la tabla de tipos, no el valor pintado */
/* ---------------------------------------------------------------- */
assert.strictEqual(categoryOf(4).key, "hiper_eficaz");
assert.strictEqual(categoryOf(2).key, "super_eficaz");
assert.strictEqual(categoryOf(1).key, "normal");
assert.strictEqual(categoryOf(0.5).key, "poco_eficaz");
assert.strictEqual(categoryOf(0.25).key, "muy_poco_eficaz");
assert.strictEqual(categoryOf(0).key, "sin_efecto");
// Coma flotante: 0.5 * 0.5 no siempre da exactamente 0.25.
assert.strictEqual(categoryOf(0.5 * 0.5).key, "muy_poco_eficaz");
console.log("10 OK  categoryOf agrupa por el producto de la tabla de tipos");

/* ---------------------------------------------------------------- */
/* 11. Validación de la tabla de multiplicadores                     */
/* ---------------------------------------------------------------- */
assert.deepStrictEqual(normalizeMultipliers(null), { ok: true, multipliers: null });
assert.deepStrictEqual(normalizeMultipliers({}), { ok: true, multipliers: null });

const conTres = normalizeMultipliers({ hiper_eficaz: 3 });
assert.strictEqual(conTres.multipliers.hiper_eficaz, 3);
assert.strictEqual(conTres.multipliers.super_eficaz, 2, "el resto se rellena con los de siempre");

// Las CLAVES son canónicas: no se pueden renombrar ni inventar categorías.
assert.strictEqual(normalizeMultipliers({ hipereficaz: 3 }).error, "clave_invalida");
assert.strictEqual(normalizeMultipliers({ hiper_eficaz: -1 }).error, "valor_invalido");
assert.strictEqual(normalizeMultipliers({ hiper_eficaz: 1000 }).error, "valor_invalido");
assert.strictEqual(normalizeMultipliers({ hiper_eficaz: "mucho" }).error, "valor_invalido");
assert.strictEqual(normalizeMultipliers([1, 2]).error, "multiplicadores_invalidos");
console.log("11 OK  claves canónicas, valores validados");

/* ---------------------------------------------------------------- */
/* 12. El motor pinta el valor del modo, no el de la tabla           */
/* ---------------------------------------------------------------- */
const estandar = createEffectiveness(fakeDb, null);
const buckets = estandar.defensiveProfile(["planta"]);
const superEstandar = buckets.find((b) => b.key === "super_eficaz");
assert.strictEqual(superEstandar.multiplier, 2);
assert.deepStrictEqual(superEstandar.types, ["fuego"]);

// Y ahora el caso que motivó la tarea: «hiper eficaz» a x3. Con la
// implementación vieja (agrupar por número) esto caía en el cubo de x2.
const raro = createEffectiveness(fakeDb, { ...DEFAULT_MULTIPLIERS, super_eficaz: 3 });
const superRaro = raro.defensiveProfile(["planta"]).find((b) => b.key === "super_eficaz");
assert.strictEqual(superRaro.multiplier, 3, "el número cambia");
assert.strictEqual(superRaro.label, "SUPEREFICAZ", "la etiqueta NO cambia");
assert.deepStrictEqual(superRaro.types, ["fuego"], "y los tipos siguen en su categoría");
console.log("12 OK  el motor redefine el valor sin mover a nadie de categoría");

/* ---------------------------------------------------------------- */
/* 13. El criterio de aceptación, de punta a punta                   */
/* ---------------------------------------------------------------- */
const rid = pedir("POST", "/", { body: { name: "Champions x3" } }).body.id;
const params = { id: String(rid) };

// Antes de tocar nada, la ficha del modo sale con los valores de siempre.
let ficha = pedir("GET", `/${rid}/pokemon/1`, { params: { ...params, pokeId: "1" } });
assert.strictEqual(ficha.status, 200);
assert.strictEqual(ficha.body.efectividad.find((b) => b.key === "super_eficaz").multiplier, 2);

// Se cambia «hiper eficaz» a x3 y la consulta del modo lo refleja.
r = pedir("PUT", `/${rid}`, { params, body: { multipliers: { hiper_eficaz: 3 } } });
assert.strictEqual(r.body.multipliers.hiper_eficaz, 3);
assert.strictEqual(r.body.multipliers_custom, true);

r = pedir("PUT", `/${rid}`, { params, body: { multipliers: { super_eficaz: 3 } } });
ficha = pedir("GET", `/${rid}/pokemon/1`, { params: { ...params, pokeId: "1" } });
assert.strictEqual(
  ficha.body.efectividad.find((b) => b.key === "super_eficaz").multiplier,
  3,
  "la ficha del modo usa los multiplicadores del conjunto"
);

// La ficha de tipo también.
const tipo = pedir("GET", `/${rid}/types/fuego`, { params: { ...params, typeId: "fuego" } });
assert.strictEqual(tipo.body.ofensivo.find((b) => b.key === "super_eficaz").multiplier, 3);

// Y el modo estándar no se entera: su motor es otro.
assert.strictEqual(
  estandar.defensiveProfile(["planta"]).find((b) => b.key === "super_eficaz").multiplier,
  2
);
console.log("13 OK  cambiar un multiplicador se refleja en las fichas del modo");

/* ---------------------------------------------------------------- */
/* 14. Restablecer, y que el motor cacheado no se quede pegado       */
/* ---------------------------------------------------------------- */
r = pedir("PUT", `/${rid}`, { params, body: { multipliers: null } });
assert.strictEqual(r.body.multipliers_custom, false);
assert.deepStrictEqual(r.body.multipliers, DEFAULT_MULTIPLIERS);

ficha = pedir("GET", `/${rid}/pokemon/1`, { params: { ...params, pokeId: "1" } });
assert.strictEqual(
  ficha.body.efectividad.find((b) => b.key === "super_eficaz").multiplier,
  2,
  "tras restablecer, la ficha vuelve a los valores de siempre"
);
console.log("14 OK  restablecer invalida el motor cacheado");

/* ---------------------------------------------------------------- */
/* 15. Un Pokémon no permitido no existe en el modo                  */
/* ---------------------------------------------------------------- */
pedir("PUT", `/${rid}`, { params, body: { allowed: { pokemon: [2] } } });
ficha = pedir("GET", `/${rid}/pokemon/1`, { params: { ...params, pokeId: "1" } });
assert.strictEqual(ficha.status, 404);
assert.strictEqual(ficha.body.error, "pokemon_no_permitido");

// Los tipos NO se filtran: son la física del juego, no contenido.
assert.strictEqual(
  pedir("GET", `/${rid}/types/fuego`, { params: { ...params, typeId: "fuego" } }).status,
  200
);
console.log("15 OK  ficha no permitida = 404, pero los tipos siguen consultables");

console.log("\nTodas las pruebas pasan.");
