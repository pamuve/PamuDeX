/**
 * Regenera backend/data/{abilities,moves,pokemon}.json desde PokeAPI.
 *
 *   node tools/fetch-dataset.js            # todo
 *   node tools/fetch-dataset.js abilities  # solo una parte
 *
 * No se ejecuta en el arranque ni en el build: la PWA es offline-first y los
 * JSON van versionados en el repo. Esto es una herramienta de mantenimiento.
 *
 * REGLA IMPORTANTE: las entradas que ya existen en los JSON se conservan. Están
 * escritas a mano (descripciones en español mejores que el flavor text de
 * PokeAPI, y el `makes_contact` que PokeAPI no tiene).
 *
 * Única excepción: en `pokemon.json` se re-derivan siempre `abilities` y
 * `hidden_ability`. Los nombres escritos a mano venían de otra fuente
 * ("Electricidad Estática") y no casaban con el vocabulario de abilities.json
 * ("Elec. Estática"), lo que dejaba referencias huérfanas que seed.js rellenaba
 * con fichas vacías sin descripción. Un solo vocabulario para todo.
 *
 * `makes_contact` no existe en PokeAPI. Los movimientos importados lo dejan a
 * null = desconocido; la ficha muestra «—» en vez de inventar un Sí/No.
 */

const fs = require("fs");
const path = require("path");

const API = "https://pokeapi.co/api/v2";
const DATA_DIR = path.join(__dirname, "..", "data");
const CONCURRENCY = 8;
const LAST_DEX = 1025;

/** Nombre de tipo en PokeAPI -> id de tipo del proyecto. */
const TYPE_ID = {
  normal: "normal", fire: "fuego", water: "agua", electric: "electrico",
  grass: "planta", ice: "hielo", fighting: "lucha", poison: "veneno",
  ground: "tierra", flying: "volador", psychic: "psiquico", bug: "bicho",
  rock: "roca", ghost: "fantasma", dragon: "dragon", dark: "siniestro",
  steel: "acero", fairy: "hada",
};

/** damage_class de PokeAPI -> categoría canónica del proyecto. */
const CATEGORY = { physical: "fisico", special: "especial", status: "estado" };

const GENERATION = {
  "generation-i": 1, "generation-ii": 2, "generation-iii": 3,
  "generation-iv": 4, "generation-v": 5, "generation-vi": 6,
  "generation-vii": 7, "generation-viii": 8, "generation-ix": 9,
};

/* ------------------------------- utilidades ------------------------------- */

const readJSON = (f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8"));
const writeJSON = (f, data) =>
  fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(data, null, 2) + "\n");

async function get(url, attempt = 1) {
  try {
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 4) throw new Error(`${url}: ${err.message}`);
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    return get(url, attempt + 1);
  }
}

/** Ejecuta tareas con un pool de concurrencia fija, conservando el orden. */
async function pool(items, worker, label) {
  const out = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await worker(items[i]);
        if (++done % 50 === 0 || done === items.length) {
          process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
        }
      }
    })
  );
  process.stdout.write("\n");
  return out;
}

const localized = (entries, key, lang, fallback) => {
  const hit = (entries || []).find((e) => e.language && e.language.name === lang);
  return hit ? hit[key] : fallback;
};

/** El flavor text trae saltos de línea duros y \f de la caja de texto del juego. */
const clean = (text) =>
  text ? text.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim() : null;

function describe(entry) {
  const es = clean(localized(entry.flavor_text_entries, "flavor_text", "es", null));
  if (es) return es;
  const enEffect = (entry.effect_entries || []).find((e) => e.language.name === "en");
  if (enEffect) return clean(enEffect.short_effect || enEffect.effect);
  return clean(localized(entry.flavor_text_entries, "flavor_text", "en", null));
}

const nameEs = (entry) => localized(entry.names, "name", "es", null) || entry.name;
const nameEn = (entry) => localized(entry.names, "name", "en", null) || entry.name;

/* -------------------------------- entidades ------------------------------- */

/**
 * Descarga todas las habilidades y devuelve además el mapa slug -> nombre en
 * español. Hace falta porque /pokemon referencia las habilidades por su slug
 * ("overgrow"), no por su nombre de display ("Overgrow").
 */
async function fetchAbilities() {
  const index = await get(`${API}/ability?limit=2000`);
  const existing = readJSON("abilities.json");
  const known = new Set(existing.map((a) => a.name_en));

  const fetched = await pool(index.results, (r) => get(r.url), "habilidades");

  const esBySlug = new Map();
  const enBySlug = new Map();
  const added = [];
  for (const a of fetched) {
    if (!a) continue;
    const es = nameEs(a);
    const en = nameEn(a);
    esBySlug.set(a.name, es);
    enBySlug.set(a.name, en);
    if (a.is_main_series === false) continue;
    if (known.has(en)) continue;
    known.add(en);
    added.push({
      name_es: es,
      name_en: en,
      generation: GENERATION[a.generation.name] || null,
      effect_es: describe(a),
    });
  }
  const all = [...existing, ...added];
  writeJSON("abilities.json", all);
  console.log(`  habilidades: ${existing.length} conservadas + ${added.length} nuevas = ${all.length}`);
  return { all, esBySlug: reconcile(esBySlug, enBySlug, all) };
}

/**
 * Reconcilia el mapa slug -> español contra abilities.json.
 *
 * Los dos lados no siempre coinciden: el JSON usa el nombre abreviado que
 * muestra el juego ("Elec. Estática") y PokeAPI devuelve el largo
 * ("Electricidad Estática"). Manda el JSON, que es donde vive la ficha con su
 * descripción; si no, los Pokémon apuntarían a habilidades inexistentes.
 */
function reconcile(esBySlug, enBySlug, abilities) {
  const esByEn = new Map(abilities.map((a) => [a.name_en, a.name_es]));
  const out = new Map();
  for (const [slug, es] of esBySlug) {
    const propio = esByEn.get(enBySlug.get(slug));
    out.set(slug, propio || es);
  }
  return out;
}

/** Solo el mapa slug -> español, para cuando se pide únicamente `pokemon`. */
async function loadAbilitySlugMap() {
  const index = await get(`${API}/ability?limit=2000`);
  const fetched = await pool(index.results, (r) => get(r.url), "habilidades (mapa)");
  const esBySlug = new Map();
  const enBySlug = new Map();
  for (const a of fetched) {
    if (!a) continue;
    esBySlug.set(a.name, nameEs(a));
    enBySlug.set(a.name, nameEn(a));
  }
  return reconcile(esBySlug, enBySlug, readJSON("abilities.json"));
}

async function fetchMoves() {
  const index = await get(`${API}/move?limit=2000`);
  const existing = readJSON("moves.json");
  const known = new Set(existing.map((m) => m.name_en));

  const fetched = await pool(index.results, (r) => get(r.url), "movimientos");

  const added = [];
  for (const m of fetched) {
    if (!m) continue;
    const en = nameEn(m);
    if (known.has(en)) continue;
    known.add(en);
    const type = TYPE_ID[m.type.name];
    if (!type) continue; // tipos que no existen en el proyecto (p. ej. "unknown")
    added.push({
      name_es: nameEs(m),
      name_en: en,
      type,
      category: CATEGORY[m.damage_class.name] || "estado",
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp,
      priority: m.priority,
      makes_contact: null, // PokeAPI no lo expone
      generation: GENERATION[m.generation.name] || null,
      effect_es: describe(m),
    });
  }
  const all = [...existing, ...added];
  writeJSON("moves.json", all);
  console.log(`  movimientos: ${existing.length} conservados + ${added.length} nuevos = ${all.length}`);
  return all;
}

async function fetchPokemon(esBySlug) {
  const existing = readJSON("pokemon.json");
  const byDex = new Map(existing.map((p) => [p.dex, p]));

  // Se recorre la dex entera, también los que ya existen: de las entradas
  // escritas a mano se conserva todo MENOS las habilidades, que se re-derivan.
  // Sus nombres venían de otra fuente ("Electricidad Estática") y no casaban
  // con el vocabulario de abilities.json ("Elec. Estática"), así que quedaban
  // referencias huérfanas que seed.js rellenaba con fichas vacías.
  const wanted = [];
  for (let dex = 1; dex <= LAST_DEX; dex++) wanted.push(dex);

  const rows = await pool(
    wanted,
    async (dex) => {
      const [mon, species] = await Promise.all([
        get(`${API}/pokemon/${dex}`),
        get(`${API}/pokemon-species/${dex}`),
      ]);
      if (!mon || !species) return null;

      const stat = (n) => (mon.stats.find((s) => s.stat.name === n) || {}).base_stat ?? null;
      // /pokemon referencia las habilidades por slug ("overgrow"); el nombre en
      // español sale del mapa construido al descargar /ability.
      const abilityName = (a) => esBySlug.get(a.ability.name) || a.ability.name;

      const normal = mon.abilities.filter((a) => !a.is_hidden).map(abilityName);
      const hidden = mon.abilities.find((a) => a.is_hidden);

      const previous = byDex.get(dex);
      if (previous) {
        return {
          ...previous,
          abilities: normal,
          hidden_ability: hidden ? abilityName(hidden) : null,
        };
      }

      return {
        dex,
        name_es: nameEs(species),
        name_en: nameEn(species),
        generation: GENERATION[species.generation.name] || null,
        types: mon.types
          .sort((a, b) => a.slot - b.slot)
          .map((t) => TYPE_ID[t.type.name])
          .filter(Boolean),
        abilities: normal,
        hidden_ability: hidden ? abilityName(hidden) : null,
        stats: {
          hp: stat("hp"), atk: stat("attack"), def: stat("defense"),
          spa: stat("special-attack"), spd: stat("special-defense"), spe: stat("speed"),
        },
        height_m: mon.height / 10,
        weight_kg: mon.weight / 10,
      };
    },
    "pokémon"
  );

  const added = rows.filter(Boolean);
  const nuevos = added.filter((p) => !byDex.has(p.dex)).length;
  const all = added.sort((a, b) => a.dex - b.dex);
  writeJSON("pokemon.json", all);
  console.log(`  pokémon: ${existing.length} conservados + ${nuevos} nuevos = ${all.length}`);
  return all;
}

/* ---------------------------------- main ---------------------------------- */

(async () => {
  const only = process.argv[2];
  const t0 = Date.now();

  // Las habilidades van primero: los Pokémon necesitan el mapa slug -> español.
  let esBySlug = null;
  if (!only || only === "abilities") ({ esBySlug } = await fetchAbilities());
  if (!only || only === "moves") await fetchMoves();
  if (!only || only === "pokemon") await fetchPokemon(esBySlug || (await loadAbilitySlugMap()));

  console.log(`\nListo en ${Math.round((Date.now() - t0) / 1000)}s. Ahora: npm run seed`);
})().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
