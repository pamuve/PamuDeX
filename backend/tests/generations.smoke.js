/**
 * Prueba de humo del modo por generación (Tareas 7.1 y 7.2), con `db`, `req` y
 * `res` simulados. No forma parte del entregable: verifica la lógica sin
 * arrancar el servidor ni SQLite.
 *
 * Lo que se comprueba:
 *  - que `has_generational_differences` va SIEMPRE en la ficha, con o sin `?gen`;
 *  - que sin `?gen` (o con uno inválido) la respuesta es la de hoy, intacta;
 *  - que el valor histórico sale de caminar hacia atrás por los `old_value`,
 *    incluida una cadena de dos cambios sobre el mismo campo;
 *  - que un cambio de tipos rehidrata las insignias y recalcula la efectividad;
 *  - que un cambio de la tabla de tipos afecta a los Pokémon aunque ellos no
 *    hayan cambiado;
 *  - que un tipo cuenta como «con diferencias» también cuando el cambio está
 *    anotado en otro, porque su perfil ofensivo se movió igual;
 *  - que `generational_changes` viaja embebido en la ficha, ordenado y con los
 *    valores ya parseados de JSON, sumando los dos lados de la tabla de tipos.
 *
 * LOS DATOS DE AQUÍ SON SINTÉTICOS. El conjunto real lo carga la Tarea 7.3; lo
 * que se prueba es el mecanismo, no el historial de Pokémon.
 */

const assert = require("assert");
const generationMode = require("../middleware/generationMode");

/* ---------------------------------------------------------------- */
/* Cambios simulados                                                  */
/* ---------------------------------------------------------------- */

const CAMBIOS = [
  // Clefairy (id 35) pasó de Normal a Hada con la llegada del tipo en la Gen 6.
  {
    entity_type: "pokemon",
    entity_ref: "35",
    generation: 6,
    field: "types",
    old_value: '["normal"]',
    new_value: '["hada"]',
    note: "Llegada del tipo Hada",
  },
  // Acero dejó de resistir Fantasma y Siniestro en la Gen 6. Se anota en el
  // DEFENSOR: entity_ref = 'acero', field = 'relation:<atacante>'.
  {
    entity_type: "type",
    entity_ref: "acero",
    generation: 6,
    field: "relation:fantasma",
    old_value: "0.5",
    new_value: "1",
    note: null,
  },
  {
    entity_type: "type",
    entity_ref: "acero",
    generation: 6,
    field: "relation:siniestro",
    old_value: "0.5",
    new_value: "1",
    note: null,
  },
  // Mordisco (id 44): era de tipo Normal hasta la Gen 2 y especial hasta la
  // división físico/especial de la Gen 4. Dos campos con fechas distintas.
  {
    entity_type: "move",
    entity_ref: "44",
    generation: 2,
    field: "type_id",
    old_value: '"normal"',
    new_value: '"siniestro"',
    note: null,
  },
  {
    entity_type: "move",
    entity_ref: "44",
    generation: 4,
    field: "category",
    old_value: '"especial"',
    new_value: '"fisico"',
    note: "División físico/especial",
  },
  // Sintético: un mismo campo con dos cambios encadenados (50 -> 80 -> 120).
  {
    entity_type: "move",
    entity_ref: "999",
    generation: 4,
    field: "power",
    old_value: "50",
    new_value: "80",
    note: null,
  },
  {
    entity_type: "move",
    entity_ref: "999",
    generation: 7,
    field: "power",
    old_value: "80",
    new_value: "120",
    note: null,
  },
];

const TIPOS = [
  { id: "normal", name_es: "Normal", name_en: "Normal", color: "#A8A878" },
  { id: "fuego", name_es: "Fuego", name_en: "Fire", color: "#F08030" },
  { id: "hada", name_es: "Hada", name_en: "Fairy", color: "#EE99AC" },
  { id: "fantasma", name_es: "Fantasma", name_en: "Ghost", color: "#705898" },
  { id: "siniestro", name_es: "Siniestro", name_en: "Dark", color: "#705848" },
  { id: "acero", name_es: "Acero", name_en: "Steel", color: "#B8B8D0" },
];

/* ---------------------------------------------------------------- */
/* Base de datos simulada                                             */
/* ---------------------------------------------------------------- */

const fakeDb = {
  prepare(sql) {
    const plano = sql.replace(/\s+/g, " ");

    if (plano.includes("FROM types")) {
      return { all: () => TIPOS };
    }

    if (plano.includes("COUNT(*)") && plano.includes("entity_type = ? AND entity_ref = ?")) {
      return {
        get: (tipo, ref) => ({
          c: CAMBIOS.filter((c) => c.entity_type === tipo && c.entity_ref === ref).length,
        }),
      };
    }

    if (plano.includes("COUNT(*)") && plano.includes("WHERE field = ?")) {
      return { get: (field) => ({ c: CAMBIOS.filter((c) => c.field === field).length }) };
    }

    if (plano.includes("entity_type = ? AND entity_ref = ? AND generation > ?")) {
      return {
        all: (tipo, ref, gen) =>
          CAMBIOS.filter((c) => c.entity_type === tipo && c.entity_ref === ref && c.generation > gen)
            .sort((a, b) => b.generation - a.generation),
      };
    }

    if (plano.includes("field LIKE 'relation:%'")) {
      return {
        all: (gen) =>
          CAMBIOS.filter(
            (c) => c.entity_type === "type" && c.field.startsWith("relation:") && c.generation > gen
          ).sort((a, b) => b.generation - a.generation),
      };
    }

    // Relaciones en las que el tipo consultado es el ATACANTE: la fila está
    // anotada en el defensor, así que se busca por `field`, no por `entity_ref`.
    if (plano.includes("entity_type = 'type' AND field = ?")) {
      return {
        all: (field) =>
          CAMBIOS.filter((c) => c.entity_type === "type" && c.field === field).sort(
            (a, b) => a.generation - b.generation || a.entity_ref.localeCompare(b.entity_ref)
          ),
      };
    }

    if (plano.includes("FROM entity_changes")) {
      return {
        all: (tipo, ref) =>
          CAMBIOS.filter((c) => c.entity_type === tipo && c.entity_ref === ref)
            .sort((a, b) => a.generation - b.generation),
      };
    }

    // `relations` no se simula: typechart.js lo captura y cae en su tabla
    // canónica, que es exactamente la de la Gen 9 y sirve de base al recálculo.
    throw new Error("consulta no simulada: " + plano);
  },
};

const middleware = generationMode(fakeDb);

/** Ejecuta el middleware y devuelve el cuerpo tal y como saldría por la red. */
function run(path, query, body) {
  let captured;
  const res = {
    status: () => res,
    json(payload) {
      captured = payload;
      return res;
    },
  };
  middleware({ path, query }, res, () => {});
  res.json(body);
  return captured;
}

const CLEFAIRY = () => ({
  id: 35,
  dex: 35,
  name_es: "Clefairy",
  generation: 1,
  types: [{ id: "hada", name_es: "Hada", name_en: "Fairy", color: "#EE99AC" }],
  stats: { hp: 70, atk: 45, def: 48, spa: 60, spd: 65, spe: 35 },
  efectividad: [
    { multiplier: 2, label: "SUPEREFICAZ", key: "super_eficaz", types: ["veneno", "acero"] },
    { multiplier: 0, label: "SIN EFECTO", key: "sin_efecto", types: ["dragon"] },
  ],
});

/** Tipos de un grupo concreto de la efectividad. */
function grupo(buckets, key) {
  const encontrado = buckets.find((b) => b.key === key);
  return encontrado ? encontrado.types : [];
}

/* ================================================================ */
/* 1. El indicador va siempre, con o sin ?gen                        */
/* ================================================================ */
assert.strictEqual(run("/pokemon/35", {}, CLEFAIRY()).has_generational_differences, true);
assert.strictEqual(
  run("/pokemon/1", {}, { id: 1, name_es: "Bulbasaur" }).has_generational_differences,
  false,
  "un Pokémon sin cambios registrados no enseña el selector"
);
// Un tipo cuenta aunque el cambio esté anotado en otro: el perfil ofensivo de
// Fantasma se movió cuando Acero dejó de resistirlo.
assert.strictEqual(
  run("/types/fantasma", {}, { id: "fantasma" }).has_generational_differences,
  true,
  "el atacante de una relación cambiada también tiene diferencias"
);
assert.strictEqual(run("/types/fuego", {}, { id: "fuego" }).has_generational_differences, false);
console.log("1 OK  has_generational_differences en toda ficha, y solo donde toca");

/* ================================================================ */
/* 2. Los listados y el resto de rutas no se tocan                   */
/* ================================================================ */
assert.deepStrictEqual(run("/pokemon", {}, [{ id: 35 }]), [{ id: 35 }]);
assert.deepStrictEqual(run("/chart", { gen: "5" }, { chart: {} }), { chart: {} });
assert.deepStrictEqual(run("/items/1", { gen: "5" }, { id: 1 }), { id: 1 }, "los objetos no");
console.log("2 OK  solo las fichas de las cuatro entidades");

/* ================================================================ */
/* 3. Sin ?gen, o con uno inválido, la respuesta es la de hoy        */
/* ================================================================ */
for (const query of [{}, { gen: "" }, { gen: "0" }, { gen: "10" }, { gen: "abc" }, { gen: "9" }]) {
  const ficha = run("/pokemon/35", query, CLEFAIRY());
  assert.deepStrictEqual(ficha.types.map((t) => t.id), ["hada"], JSON.stringify(query));
  assert.deepStrictEqual(ficha.efectividad, CLEFAIRY().efectividad, JSON.stringify(query));
}
console.log("3 OK  sin ?gen válido no se reescribe nada");

/* ================================================================ */
/* 4. Caminar hacia atrás: el old_value del cambio MÁS ANTIGUO       */
/* ================================================================ */
const mordisco = () => ({
  id: 44,
  name_es: "Mordisco",
  type_id: "siniestro",
  color: "#705848",
  type_name_es: "Siniestro",
  type_name_en: "Dark",
  category: "fisico",
  power: 60,
});

// La generación de la fila es la de ENTRADA EN VIGOR: el cambio de categoría
// está fechado en la 4, así que en la 5 ya era físico y en la 3 todavía no.
assert.strictEqual(run("/moves/44", { gen: "5" }, mordisco()).category, "fisico");

const gen3 = run("/moves/44", { gen: "3" }, mordisco());
assert.strictEqual(gen3.category, "especial", "antes de la división de la Gen 4");
assert.strictEqual(gen3.type_id, "siniestro", "pero ya era Siniestro desde la Gen 2");

const gen1 = run("/moves/44", { gen: "1" }, mordisco());
assert.strictEqual(gen1.category, "especial");
assert.strictEqual(gen1.type_id, "normal", "en la Gen 1 era Normal");
assert.strictEqual(gen1.type_name_es, "Normal", "el nombre del tipo acompaña");
assert.strictEqual(gen1.color, "#A8A878", "y el color también");

// Cadena de dos cambios sobre el mismo campo: 50 -> 80 (Gen 4) -> 120 (Gen 7).
assert.strictEqual(run("/moves/999", { gen: "8" }, { id: 999, power: 120 }).power, 120);
assert.strictEqual(run("/moves/999", { gen: "6" }, { id: 999, power: 120 }).power, 80);
assert.strictEqual(run("/moves/999", { gen: "3" }, { id: 999, power: 120 }).power, 50);
console.log("4 OK  valor histórico por el old_value más antiguo, incluida la cadena");

/* ================================================================ */
/* 5. Cambio de tipos: insignias rehidratadas y efectividad rehecha  */
/* ================================================================ */
const clefairyGen5 = run("/pokemon/35", { gen: "5" }, CLEFAIRY());
assert.deepStrictEqual(clefairyGen5.types.map((t) => t.id), ["normal"]);
assert.strictEqual(clefairyGen5.types[0].name_es, "Normal", "el id se rehidrata a objeto");
assert.strictEqual(clefairyGen5.types[0].color, "#A8A878");
assert.ok(
  grupo(clefairyGen5.efectividad, "sin_efecto").includes("fantasma"),
  "siendo Normal, Fantasma no le hace nada"
);
assert.ok(
  grupo(clefairyGen5.efectividad, "super_eficaz").includes("lucha"),
  "y Lucha pasa a ser superefectivo"
);
assert.ok(
  !grupo(clefairyGen5.efectividad, "super_eficaz").includes("veneno"),
  "Veneno ya no le hace el doble: eso era por ser Hada"
);
assert.strictEqual(clefairyGen5.stats.hp, 70, "lo que no cambió se queda igual");
console.log("5 OK  tipos históricos con efectividad recalculada");

/* ================================================================ */
/* 6. La tabla de tipos histórica llega a quien no cambió            */
/* ================================================================ */
const acero = () => ({
  id: "acero",
  name_es: "Acero",
  ofensivo: [{ multiplier: 2, label: "SUPEREFICAZ", key: "super_eficaz", types: ["hada"] }],
  defensivo: [{ multiplier: 0.5, label: "POCO EFICAZ", key: "poco_eficaz", types: ["normal"] }],
});

const aceroGen5 = run("/types/acero", { gen: "5" }, acero());
const resistidosGen5 = grupo(aceroGen5.defensivo, "poco_eficaz");
assert.ok(resistidosGen5.includes("fantasma"), "en la Gen 5 Acero resistía Fantasma");
assert.ok(resistidosGen5.includes("siniestro"), "y también Siniestro");

const aceroHoy = run("/types/acero", {}, acero());
assert.deepStrictEqual(aceroHoy.defensivo, acero().defensivo, "hoy la ficha no se toca");

// Un Pokémon de Acero se beneficia igual, sin tener ni un cambio propio.
const skarmory = {
  id: 227,
  types: [{ id: "acero", name_es: "Acero", name_en: "Steel", color: "#B8B8D0" }],
  efectividad: [{ multiplier: 2, label: "SUPEREFICAZ", key: "super_eficaz", types: ["fuego"] }],
};
const skarmoryGen5 = run("/pokemon/227", { gen: "5" }, JSON.parse(JSON.stringify(skarmory)));
assert.strictEqual(skarmoryGen5.has_generational_differences, false, "él no cambió…");
assert.ok(
  grupo(skarmoryGen5.efectividad, "poco_eficaz").includes("fantasma"),
  "…pero la tabla de tipos sí, y su efectividad lo refleja"
);
console.log("6 OK  las relaciones históricas alcanzan a tipos y a Pokémon");

/* ================================================================ */
/* 7. Los cambios viajan embebidos en la ficha (Tarea 7.2)           */
/* ================================================================ */
const conCambios = run("/pokemon/35", {}, CLEFAIRY());
assert.deepStrictEqual(
  conCambios.generational_changes,
  [
    {
      generation: 6,
      field: "types",
      old_value: ["normal"],
      new_value: ["hada"],
      note: "Llegada del tipo Hada",
    },
  ],
  "los valores vuelven parseados de JSON, no como cadenas"
);

// Sin cambios, lista vacía: la ficha no arrastra un campo que no significa nada.
assert.deepStrictEqual(run("/pokemon/1", {}, { id: 1 }).generational_changes, []);

// Ordenados de la generación más antigua a la más nueva.
assert.deepStrictEqual(
  run("/moves/44", {}, mordisco()).generational_changes.map((c) => [c.generation, c.field]),
  [[2, "type_id"], [4, "category"]]
);

// Un tipo suma los DOS lados de la tabla. Acero es el defensor, así que sus
// cambios salen como `relation:<atacante>`…
assert.deepStrictEqual(
  run("/types/acero", {}, acero()).generational_changes.map((c) => c.field),
  ["relation:fantasma", "relation:siniestro"]
);
// …y Fantasma, que es el atacante, los ve como `relation_out:<defensor>`.
const fantasma = run("/types/fantasma", {}, { id: "fantasma" });
assert.deepStrictEqual(
  fantasma.generational_changes,
  [{ generation: 6, field: "relation_out:acero", old_value: 0.5, new_value: 1, note: null }],
  "sin esto, Fantasma diría que tiene diferencias y no sabría enseñar ninguna"
);
console.log("7 OK  generational_changes embebido, con los dos lados de la tabla");

/* ================================================================ */
/* 8. Degradación segura                                             */
/* ================================================================ */
assert.strictEqual(run("/pokemon/35", { gen: "5" }, null), null);
assert.strictEqual(run("/pokemon/35", { gen: "5" }, "no soy JSON"), "no soy JSON");
assert.deepStrictEqual(
  run("/pokemon/9999", { gen: "5" }, { error: "Pokémon no encontrado" }),
  { error: "Pokémon no encontrado" },
  "un 404 no se decora"
);
// Una base sin la tabla `entity_changes` (migración fallada) responde el dato
// actual en vez de romper la ficha.
const sinTabla = generationMode({
  prepare() {
    throw new Error("no such table: entity_changes");
  },
});
let respuesta;
const resSinTabla = {
  status: () => resSinTabla,
  json: (b) => {
    respuesta = b;
    return resSinTabla;
  },
};
sinTabla({ path: "/pokemon/35", query: { gen: "5" } }, resSinTabla, () => {});
resSinTabla.json(CLEFAIRY());
assert.strictEqual(respuesta.has_generational_differences, false);
assert.deepStrictEqual(respuesta.types.map((t) => t.id), ["hada"], "responde el dato actual");
console.log("8 OK  degradación segura ante cuerpos raros y tablas ausentes");

console.log("\nTodas las pruebas pasan.");
