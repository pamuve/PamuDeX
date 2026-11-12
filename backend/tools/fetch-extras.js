"use strict";

/**
 * PamuDeX — genera los datos «extra» del dataset (Fase 9):
 *
 *   data/learnsets.json   qué movimientos aprende cada Pokémon y cómo
 *   data/evolutions.json  quién evoluciona a quién y de qué forma
 *   data/forms.json       megas, formas regionales y formas con stats propios
 *   data/effects_en.json  efectos en inglés de movimientos, habilidades y objetos
 *
 *   cd backend && node tools/fetch-extras.js            # descarga y genera
 *   cd backend && node tools/fetch-extras.js --csv DIR  # usa CSV ya descargados
 *
 * Igual que `fetch-dataset.js`, NO se ejecuta en el arranque ni en el build: los
 * JSON van versionados para que la app siga sin necesitar red.
 *
 * POR QUÉ LOS CSV Y NO LA API
 * ---------------------------
 * `fetch-dataset.js` pregunta a pokeapi.co entidad por entidad. Los movimientos
 * por Pokémon serían 1025 respuestas de cientos de KB cada una. PokeAPI publica
 * los mismos datos como CSV en su repositorio, y con una docena de archivos sale
 * todo de una vez.
 *
 * TODO SE REFERENCIA POR CLAVE NATURAL
 * ------------------------------------
 * Pokémon por nº de Pokédex y movimientos, habilidades y objetos por `name_en`,
 * igual que `entity_changes.json`. Los ids internos los reparte SQLite al
 * sembrar y no son estables entre instalaciones; quien carga estos archivos
 * (`db/extras.js`) los resuelve contra la base que tenga delante.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";
const DATA_DIR = path.join(__dirname, "..", "data");
const LAST_DEX = 1025;

const ARCHIVOS = [
  "pokemon", "pokemon_species", "pokemon_species_names", "pokemon_moves", "pokemon_evolution",
  "pokemon_forms", "pokemon_form_names", "pokemon_types", "pokemon_stats",
  "moves", "move_names", "move_effect_prose", "move_flavor_text",
  "abilities", "ability_names", "ability_prose", "ability_flavor_text",
  "items", "item_names", "item_prose", "item_flavor_text",
  "version_groups", "location_names",
];

/** ids de tipo de PokeAPI -> ids canónicos de PamuDeX. */
const TIPOS = {
  1: "normal", 2: "lucha", 3: "volador", 4: "veneno", 5: "tierra", 6: "roca",
  7: "bicho", 8: "fantasma", 9: "acero", 10: "fuego", 11: "agua", 12: "planta",
  13: "electrico", 14: "psiquico", 15: "hielo", 16: "dragon", 17: "siniestro", 18: "hada",
};
const NOMBRE_TIPO = {
  es: { normal: "Normal", lucha: "Lucha", volador: "Volador", veneno: "Veneno", tierra: "Tierra", roca: "Roca", bicho: "Bicho", fantasma: "Fantasma", acero: "Acero", fuego: "Fuego", agua: "Agua", planta: "Planta", electrico: "Eléctrico", psiquico: "Psíquico", hielo: "Hielo", dragon: "Dragón", siniestro: "Siniestro", hada: "Hada" },
  en: { normal: "Normal", lucha: "Fighting", volador: "Flying", veneno: "Poison", tierra: "Ground", roca: "Rock", bicho: "Bug", fantasma: "Ghost", acero: "Steel", fuego: "Fire", agua: "Water", planta: "Grass", electrico: "Electric", psiquico: "Psychic", hielo: "Ice", dragon: "Dragon", siniestro: "Dark", hada: "Fairy" },
};
const STATS = { 1: "hp", 2: "atk", 3: "def", 4: "spa", 5: "spd", 6: "spe" };
const ES = "7";
const EN = "9";

/* ------------------------------- utilidades ------------------------------- */

/** CSV con comillas y saltos de línea dentro de un campo (los textos los traen). */
function parseCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = "";
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreComillas = false;
      } else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo !== "" || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  const cabecera = filas.shift();
  return filas
    .filter((f) => f.length === cabecera.length)
    .map((f) => Object.fromEntries(cabecera.map((k, i) => [k, f[i]])));
}

async function cargar(dir) {
  const tablas = {};
  for (const nombre of ARCHIVOS) {
    const archivo = path.join(dir, `${nombre}.csv`);
    if (!fs.existsSync(archivo)) {
      process.stdout.write(`  descargando ${nombre}.csv\n`);
      const res = await fetch(`${BASE}/${nombre}.csv`);
      if (!res.ok) throw new Error(`${nombre}.csv: HTTP ${res.status}`);
      fs.writeFileSync(archivo, Buffer.from(await res.arrayBuffer()));
    }
    tablas[nombre] = parseCsv(fs.readFileSync(archivo, "utf-8"));
  }
  return tablas;
}

/** Mapa id -> nombre en un idioma, de una tabla `*_names`. */
function nombres(filas, columnaId, idioma, columnaNombre = "name") {
  const mapa = new Map();
  for (const f of filas) if (f.local_language_id === idioma && f[columnaNombre]) mapa.set(f[columnaId], f[columnaNombre]);
  return mapa;
}

/** Quita el marcado de PokeAPI: `[paralyzed]{mechanic:paralysis}` -> `paralyzed`. */
function limpiar(texto) {
  if (!texto) return "";
  return texto
    .replace(/\[([^\]]*)\]\{[a-z]+:([^}]+)\}/g, (_, visible, id) => visible || id.replace(/-/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function escribir(nombre, datos) {
  const destino = path.join(DATA_DIR, nombre);
  fs.writeFileSync(destino, JSON.stringify(datos));
  console.log(`✔ ${nombre} (${(fs.statSync(destino).size / 1024).toFixed(0)} KB)`);
}

/* -------------------------------- learnsets ------------------------------- */

function learnsets(t, nuestrosMovimientos) {
  const nombreEn = nombres(t.move_names, "move_id", EN);
  const orden = new Map(t.version_groups.map((v) => [v.id, Number(v.order)]));
  const METODO = { 1: "l", 2: "e", 3: "t", 4: "m" };

  // El índice de movimientos va una vez en el archivo y cada entrada lo
  // referencia por posición: con el nombre repetido en cada una el JSON pesaría
  // el triple.
  const lista = [...nuestrosMovimientos].sort();
  const indice = new Map(lista.map((n, i) => [n, i]));

  // dex -> metodo -> Map(indiceMovimiento -> { nivel, orden })
  const sets = {};
  for (const f of t.pokemon_moves) {
    const dex = Number(f.pokemon_id);
    if (dex > LAST_DEX) continue; // las formas alternativas no son fichas propias
    const metodo = METODO[f.pokemon_move_method_id];
    if (!metodo) continue;
    const i = indice.get(nombreEn.get(f.move_id));
    if (i === undefined) continue; // movimiento que no está en nuestro dataset (Z, Dinamax…)

    const delPokemon = (sets[dex] = sets[dex] || { l: new Map(), m: new Map(), e: new Map(), t: new Map() });
    const o = orden.get(f.version_group_id) || 0;
    const previo = delPokemon[metodo].get(i);
    // Se une lo de TODOS los juegos (un ROM Hack suele mezclar generaciones),
    // y el nivel es el del juego más reciente en el que lo aprende subiendo.
    if (!previo || o > previo.orden) delPokemon[metodo].set(i, { nivel: Number(f.level) || 1, orden: o });
  }

  const salida = {};
  let total = 0;
  for (const [dex, m] of Object.entries(sets)) {
    const l = [...m.l].map(([i, v]) => [i, v.nivel]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const simple = (mapa) => [...mapa.keys()].sort((a, b) => a - b);
    salida[dex] = { l, m: simple(m.m), e: simple(m.e), t: simple(m.t) };
    total += l.length + m.m.size + m.e.size + m.t.size;
  }
  console.log(`  ${Object.keys(salida).length} Pokémon, ${total} entradas`);
  return { moves: lista, sets: salida };
}

/* ------------------------------- evoluciones ------------------------------ */

function evoluciones(t) {
  const item = { es: nombres(t.item_names, "item_id", ES), en: nombres(t.item_names, "item_id", EN) };
  const mov = { es: nombres(t.move_names, "move_id", ES), en: nombres(t.move_names, "move_id", EN) };
  const especie = {
    es: nombres(t.pokemon_species_names, "pokemon_species_id", ES),
    en: nombres(t.pokemon_species_names, "pokemon_species_id", EN),
  };
  const lugar = { es: nombres(t.location_names, "location_id", ES), en: nombres(t.location_names, "location_id", EN) };

  const TXT = {
    es: {
      level: (n) => `Nivel ${n}`, levelUp: "Subir de nivel", trade: "Intercambio", use: (x) => `Usar ${x}`,
      holding: (x) => `con ${x} equipado`, happy: "con amistad alta", affection: "con afecto alto",
      beauty: "con belleza alta", day: "de día", night: "de noche", dusk: "al atardecer",
      knows: (x) => `sabiendo ${x}`, knowsType: (x) => `sabiendo un movimiento de tipo ${x}`,
      at: (x) => `en ${x}`, rain: "con lluvia", upside: "con la consola boca abajo",
      female: "hembra", male: "macho", party: (x) => `con ${x} en el equipo`,
      partyType: (x) => `con un Pokémon de tipo ${x} en el equipo`, tradeFor: (x) => `por ${x}`,
      atkGtDef: "con Ataque > Defensa", atkLtDef: "con Ataque < Defensa", atkEqDef: "con Ataque = Defensa",
      special: "Método especial", shed: "Hueco libre en el equipo y una Poké Ball",
      rock: "junto a una roca especial", usedMove: (x, n) => `usar ${x} ${n} veces`,
    },
    en: {
      level: (n) => `Level ${n}`, levelUp: "Level up", trade: "Trade", use: (x) => `Use ${x}`,
      holding: (x) => `holding ${x}`, happy: "with high friendship", affection: "with high affection",
      beauty: "with high beauty", day: "during the day", night: "at night", dusk: "at dusk",
      knows: (x) => `knowing ${x}`, knowsType: (x) => `knowing a ${x}-type move`,
      at: (x) => `at ${x}`, rain: "while raining", upside: "holding the console upside down",
      female: "female", male: "male", party: (x) => `with ${x} in the party`,
      partyType: (x) => `with a ${x}-type Pokémon in the party`, tradeFor: (x) => `for ${x}`,
      atkGtDef: "with Attack > Defense", atkLtDef: "with Attack < Defense", atkEqDef: "with Attack = Defense",
      special: "Special method", shed: "Empty party slot and a Poké Ball",
      rock: "near a special rock", usedMove: (x, n) => `use ${x} ${n} times`,
    },
  };

  function metodo(f, lang) {
    const T = TXT[lang];
    const partes = [];
    const trigger = f.evolution_trigger_id;
    if (trigger === "1") partes.push(f.minimum_level ? T.level(f.minimum_level) : T.levelUp);
    else if (trigger === "2") partes.push(T.trade);
    else if (trigger === "3") partes.push(T.use(item[lang].get(f.trigger_item_id) || "?"));
    else if (trigger === "4") partes.push(T.shed);
    else if (f.used_move_id && f.minimum_move_count) partes.push(T.usedMove(mov[lang].get(f.used_move_id) || "?", f.minimum_move_count));
    else partes.push(T.special);

    if (f.held_item_id) partes.push(T.holding(item[lang].get(f.held_item_id) || "?"));
    if (f.minimum_happiness) partes.push(T.happy);
    if (f.minimum_affection) partes.push(T.affection);
    if (f.minimum_beauty) partes.push(T.beauty);
    if (f.time_of_day === "day") partes.push(T.day);
    if (f.time_of_day === "night" || f.time_of_day === "full-moon") partes.push(T.night);
    if (f.time_of_day === "dusk") partes.push(T.dusk);
    if (f.known_move_id) partes.push(T.knows(mov[lang].get(f.known_move_id) || "?"));
    if (f.known_move_type_id) partes.push(T.knowsType(NOMBRE_TIPO[lang][TIPOS[f.known_move_type_id]] || "?"));
    if (f.location_id && lugar[lang].get(f.location_id)) partes.push(T.at(lugar[lang].get(f.location_id)));
    if (f.near_special_rock === "1") partes.push(T.rock);
    if (f.needs_overworld_rain === "1") partes.push(T.rain);
    if (f.turn_upside_down === "1") partes.push(T.upside);
    if (f.gender_id === "1") partes.push(T.female);
    if (f.gender_id === "2") partes.push(T.male);
    if (f.party_species_id) partes.push(T.party(especie[lang].get(f.party_species_id) || "?"));
    if (f.party_type_id) partes.push(T.partyType(NOMBRE_TIPO[lang][TIPOS[f.party_type_id]] || "?"));
    if (f.trade_species_id) partes.push(T.tradeFor(especie[lang].get(f.trade_species_id) || "?"));
    if (f.relative_physical_stats === "1") partes.push(T.atkGtDef);
    if (f.relative_physical_stats === "-1") partes.push(T.atkLtDef);
    if (f.relative_physical_stats === "0") partes.push(T.atkEqDef);
    return partes.join(" ");
  }

  const origen = new Map(t.pokemon_species.map((s) => [s.id, s.evolves_from_species_id]));
  const porDestino = new Map();
  for (const f of t.pokemon_evolution) {
    if (f.is_default !== "1") continue; // las no predeterminadas son métodos de juegos antiguos
    if (!porDestino.has(f.evolved_species_id)) porDestino.set(f.evolved_species_id, []);
    porDestino.get(f.evolved_species_id).push(f);
  }

  const salida = [];
  for (const [destino, desde] of origen) {
    if (!desde || Number(destino) > LAST_DEX || Number(desde) > LAST_DEX) continue;
    const filas = porDestino.get(destino) || [];
    const unir = (lang) => [...new Set(filas.map((f) => metodo(f, lang)))].slice(0, 3).join(" / ");
    salida.push({
      from: Number(desde),
      to: Number(destino),
      method_es: unir("es") || TXT.es.special,
      method_en: unir("en") || TXT.en.special,
    });
  }
  salida.sort((a, b) => a.from - b.from || a.to - b.to);
  console.log(`  ${salida.length} evoluciones`);
  return salida;
}

/* ---------------------------------- formas -------------------------------- */

function formas(t) {
  const especie = {
    es: nombres(t.pokemon_species_names, "pokemon_species_id", ES),
    en: nombres(t.pokemon_species_names, "pokemon_species_id", EN),
  };
  const nombreCompleto = {
    es: nombres(t.pokemon_form_names, "pokemon_form_id", ES, "pokemon_name"),
    en: nombres(t.pokemon_form_names, "pokemon_form_id", EN, "pokemon_name"),
  };
  const nombreForma = {
    es: nombres(t.pokemon_form_names, "pokemon_form_id", ES, "form_name"),
    en: nombres(t.pokemon_form_names, "pokemon_form_id", EN, "form_name"),
  };

  const tiposDe = new Map();
  for (const f of t.pokemon_types) {
    if (!tiposDe.has(f.pokemon_id)) tiposDe.set(f.pokemon_id, []);
    tiposDe.get(f.pokemon_id)[Number(f.slot) - 1] = TIPOS[f.type_id];
  }
  const statsDe = new Map();
  for (const f of t.pokemon_stats) {
    if (!STATS[f.stat_id]) continue;
    if (!statsDe.has(f.pokemon_id)) statsDe.set(f.pokemon_id, {});
    statsDe.get(f.pokemon_id)[STATS[f.stat_id]] = Number(f.base_stat);
  }
  // La forma «principal» de cada variedad: la que comparte identificador con ella.
  const formaDe = new Map();
  for (const f of t.pokemon_forms) {
    if (!formaDe.has(f.pokemon_id) || f.is_default === "1") formaDe.set(f.pokemon_id, f);
  }

  const REGIONAL = /-(alola|galar|hisui|paldea)(-|$)/;
  const DESCARTAR = /(gmax|totem|-cap$|cosplay|-starter|rock-star|belle|pop-star|phd|libre|-partner)/;
  const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const salida = [];
  for (const p of t.pokemon) {
    if (p.is_default === "1") continue;
    const dex = Number(p.species_id);
    if (dex > LAST_DEX || DESCARTAR.test(p.identifier)) continue;
    const forma = formaDe.get(p.id);
    if (!forma) continue;

    const tipos = (tiposDe.get(p.id) || []).filter(Boolean);
    const stats = statsDe.get(p.id);
    if (!tipos.length || !stats) continue;

    let kind = "other";
    if (forma.is_mega === "1" || /-primal$/.test(p.identifier)) kind = "mega";
    else if (REGIONAL.test(p.identifier)) kind = "regional";
    // Una forma «otra» solo interesa si cambia algo que la ficha enseña.
    if (kind === "other" && iguales(tipos, (tiposDe.get(p.species_id) || []).filter(Boolean)) && iguales(stats, statsDe.get(p.species_id))) continue;

    const nombre = (lang) => {
      const completo = nombreCompleto[lang].get(forma.id);
      if (completo) return completo;
      const base = especie[lang].get(p.species_id) || p.identifier;
      const sufijo = nombreForma[lang].get(forma.id);
      // Sin nombre en este idioma (megas recientes): vale más el inglés que
      // repetir el de la especie, que no distingue una forma de otra.
      if (!sufijo) return lang === "es" ? nombre("en") : base;
      // «Mega-Charizard X» ya es el nombre entero; «Forma de Alola» no.
      return sufijo.toLowerCase().includes(base.toLowerCase()) ? sufijo : `${base} (${sufijo})`;
    };

    salida.push({
      dex,
      key: p.identifier,
      sprite: Number(p.id),
      kind,
      name_es: nombre("es"),
      name_en: nombre("en"),
      types: tipos,
      stats,
      height_m: Number(p.height) / 10,
      weight_kg: Number(p.weight) / 10,
    });
  }
  salida.sort((a, b) => a.dex - b.dex || a.sprite - b.sprite);
  const cuenta = salida.reduce((acc, f) => ((acc[f.kind] = (acc[f.kind] || 0) + 1), acc), {});
  console.log(`  ${salida.length} formas`, cuenta);
  return salida;
}

/* ----------------------------- efectos en inglés -------------------------- */

function efectos(t, nuestros) {
  /** El texto más reciente de una tabla `*_flavor_text` en inglés. */
  function ultimoFlavor(filas, columnaId) {
    const mapa = new Map();
    for (const f of filas) {
      if (f.language_id !== EN) continue;
      const previo = mapa.get(f[columnaId]);
      if (!previo || Number(f.version_group_id) >= previo.vg) {
        mapa.set(f[columnaId], { vg: Number(f.version_group_id), texto: f.flavor_text });
      }
    }
    return mapa;
  }
  const prosa = (filas, columnaId) => {
    const mapa = new Map();
    for (const f of filas) if (f.local_language_id === EN) mapa.set(f[columnaId], f.short_effect || f.effect);
    return mapa;
  };

  const salida = { moves: {}, abilities: {}, items: {} };

  // Movimientos: la prosa cuelga del EFECTO, no del movimiento, y lleva un
  // `$effect_chance` que hay que sustituir por el del movimiento concreto.
  const prosaEfecto = prosa(t.move_effect_prose, "move_effect_id");
  const flavorMov = ultimoFlavor(t.move_flavor_text, "move_id");
  const nombreMov = nombres(t.move_names, "move_id", EN);
  for (const m of t.moves) {
    const nombre = nombreMov.get(m.id);
    if (!nombre || !nuestros.moves.has(nombre)) continue;
    let texto = prosaEfecto.get(m.effect_id) || "";
    texto = texto.replace(/\$effect_chance/g, m.effect_chance || "");
    // En los CSV el marcador ya viene quitado («Has a chance to…»): se repone.
    if (m.effect_chance) texto = texto.replace(/\b([Hh])as a chance\b/g, `$1as a ${m.effect_chance}% chance`);
    texto = limpiar(texto) || limpiar(flavorMov.get(m.id) && flavorMov.get(m.id).texto);
    if (texto) salida.moves[nombre] = texto;
  }

  const prosaHab = prosa(t.ability_prose, "ability_id");
  const flavorHab = ultimoFlavor(t.ability_flavor_text, "ability_id");
  const nombreHab = nombres(t.ability_names, "ability_id", EN);
  for (const a of t.abilities) {
    const nombre = nombreHab.get(a.id);
    if (!nombre || !nuestros.abilities.has(nombre)) continue;
    const texto = limpiar(prosaHab.get(a.id)) || limpiar(flavorHab.get(a.id) && flavorHab.get(a.id).texto);
    if (texto) salida.abilities[nombre] = texto;
  }

  const prosaObj = prosa(t.item_prose, "item_id");
  const flavorObj = ultimoFlavor(t.item_flavor_text, "item_id");
  const nombreObj = nombres(t.item_names, "item_id", EN);
  for (const it of t.items) {
    const nombre = nombreObj.get(it.id);
    if (!nombre || !nuestros.items.has(nombre)) continue;
    const texto = limpiar(prosaObj.get(it.id)) || limpiar(flavorObj.get(it.id) && flavorObj.get(it.id).texto);
    if (texto) salida.items[nombre] = texto;
  }

  for (const k of Object.keys(salida)) {
    console.log(`  ${k}: ${Object.keys(salida[k]).length} de ${nuestros[k].size}`);
  }
  return salida;
}

/* ---------------------------------- main ---------------------------------- */

async function main() {
  const iCsv = process.argv.indexOf("--csv");
  const dir = iCsv !== -1 ? process.argv[iCsv + 1] : fs.mkdtempSync(path.join(os.tmpdir(), "pamudex-csv-"));
  fs.mkdirSync(dir, { recursive: true });

  const leer = (archivo) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, archivo), "utf-8"));
  const nuestros = {
    moves: new Set(leer("moves.json").map((m) => m.name_en)),
    abilities: new Set(leer("abilities.json").map((a) => a.name_en)),
    items: new Set(leer("items.json").map((i) => i.name_en)),
  };

  console.log(`CSV en ${dir}`);
  const t = await cargar(dir);

  console.log("Movimientos por Pokémon…");
  escribir("learnsets.json", learnsets(t, nuestros.moves));
  console.log("Evoluciones…");
  escribir("evolutions.json", evoluciones(t));
  console.log("Formas…");
  escribir("forms.json", formas(t));
  console.log("Efectos en inglés…");
  escribir("effects_en.json", efectos(t, nuestros));
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
