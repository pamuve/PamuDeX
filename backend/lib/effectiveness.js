const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "..", "db", "pamudex.sqlite"), { readonly: true, fileMustExist: true });

const ALL_TYPES = db.prepare("SELECT id FROM types").all().map((r) => r.id);

const LABELS = {
  4: { key: "hiper_eficaz", es: "HIPER EFICAZ" },
  2: { key: "super_eficaz", es: "SUPEREFICAZ" },
  1: { key: "normal", es: "NORMAL" },
  0.5: { key: "poco_eficaz", es: "POCO EFICAZ" },
  0.25: { key: "muy_poco_eficaz", es: "MUY POCO EFICAZ" },
  0: { key: "sin_efecto", es: "SIN EFECTO" },
};

function getMultiplier(attackerType, defenderType) {
  const row = db
    .prepare("SELECT multiplier FROM relations WHERE attacker_type = ? AND defender_type = ?")
    .get(attackerType, defenderType);
  return row ? row.multiplier : 1;
}

// Efectividad DEFENSIVA de un Pokémon (posiblemente dual-type) contra cada tipo atacante
function defensiveProfile(defenderTypes) {
  const buckets = { 4: [], 2: [], 1: [], 0.5: [], 0.25: [], 0: [] };
  ALL_TYPES.forEach((attackerType) => {
    let total = 1;
    defenderTypes.forEach((dt) => {
      total *= getMultiplier(attackerType, dt);
    });
    // Normaliza a una de las claves conocidas (evita floats raros)
    const key = [4, 2, 1, 0.5, 0.25, 0].reduce((closest, k) =>
      Math.abs(total - k) < Math.abs(total - closest) ? k : closest
    );
    buckets[key].push(attackerType);
  });
  return Object.entries(buckets)
    .filter(([, types]) => types.length > 0)
    .map(([mult, types]) => ({
      multiplier: Number(mult),
      label: LABELS[mult].es,
      key: LABELS[mult].key,
      types,
    }))
    .sort((a, b) => b.multiplier - a.multiplier);
}

// Efectividad OFENSIVA de un tipo de ataque contra todos los tipos existentes
function offensiveProfile(attackerType) {
  const buckets = { 4: [], 2: [], 1: [], 0.5: [], 0.25: [], 0: [] };
  ALL_TYPES.forEach((defenderType) => {
    const mult = getMultiplier(attackerType, defenderType);
    buckets[mult] = buckets[mult] || [];
    buckets[mult].push(defenderType);
  });
  return Object.entries(buckets)
    .filter(([, types]) => types.length > 0)
    .map(([mult, types]) => ({
      multiplier: Number(mult),
      label: LABELS[mult] ? LABELS[mult].es : `x${mult}`,
      key: LABELS[mult] ? LABELS[mult].key : `x${mult}`,
      types,
    }))
    .sort((a, b) => b.multiplier - a.multiplier);
}

// Efectividad DEFENSIVA de un tipo (single) frente a todos los tipos atacantes — panel "Defensivo" de consulta por tipo
function defensiveProfileForSingleType(defenderType) {
  return defensiveProfile([defenderType]);
}

module.exports = { defensiveProfile, offensiveProfile, defensiveProfileForSingleType, ALL_TYPES };