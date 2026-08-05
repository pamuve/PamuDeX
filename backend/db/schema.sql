-- PamuDeX · esquema SQLite
-- Tablas núcleo (activas en esta fase) + tablas de Fase 2 (creadas pero aún sin lógica de negocio)

PRAGMA foreign_keys = ON;

-- ===================== NÚCLEO (Fase 1, activo) =====================

CREATE TABLE IF NOT EXISTS generations (
  id INTEGER PRIMARY KEY,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS types (
  id TEXT PRIMARY KEY,          -- ej. 'fuego'
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  color TEXT NOT NULL
);

-- Relations: tabla de relaciones de tipos (atacante -> defensor -> multiplicador)
CREATE TABLE IF NOT EXISTS relations (
  attacker_type TEXT NOT NULL REFERENCES types(id),
  defender_type TEXT NOT NULL REFERENCES types(id),
  multiplier REAL NOT NULL,
  generation INTEGER DEFAULT 6,
  PRIMARY KEY (attacker_type, defender_type, generation)
);

CREATE TABLE IF NOT EXISTS pokemon (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dex INTEGER NOT NULL,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  generation INTEGER NOT NULL,
  hidden_ability TEXT,
  hp INTEGER, atk INTEGER, def INTEGER, spa INTEGER, spd INTEGER, spe INTEGER,
  height_m REAL,
  weight_kg REAL,
  sprite_path TEXT
);

CREATE TABLE IF NOT EXISTS pokemon_types (
  pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  type_id TEXT NOT NULL REFERENCES types(id),
  slot INTEGER NOT NULL,
  PRIMARY KEY (pokemon_id, slot)
);

CREATE TABLE IF NOT EXISTS abilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  generation INTEGER,
  effect_es TEXT
);

CREATE TABLE IF NOT EXISTS pokemon_abilities (
  pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  ability_id INTEGER NOT NULL REFERENCES abilities(id),
  is_hidden INTEGER DEFAULT 0,
  PRIMARY KEY (pokemon_id, ability_id)
);

CREATE TABLE IF NOT EXISTS moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  type_id TEXT NOT NULL REFERENCES types(id),
  category TEXT NOT NULL CHECK (category IN ('fisico','especial','estado')),
  power INTEGER,
  accuracy INTEGER,
  pp INTEGER,
  priority INTEGER DEFAULT 0,
  makes_contact INTEGER DEFAULT 0,
  generation INTEGER,
  effect_es TEXT
);

-- ===================== FASE 2 (esquema preparado, sin UI todavía) =====================

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_es TEXT NOT NULL,
  name_en TEXT,
  category TEXT,
  effect_es TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,           -- NULL = perfil sin contraseña
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- El PIN de perfil vive AQUÍ, no en users.password_hash. Son dos cosas
-- distintas: `users` es la credencial de cuenta (login real, si algún día se
-- expone la app) y `pin_hash` es el bloqueo blando entre convivientes, como el
-- PIN de perfil de Netflix. Reusar users.password_hash obligaría a inventar una
-- fila de users falsa por perfil y rompería el 1:N cuenta -> perfiles.
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar TEXT,
  color TEXT,
  language TEXT DEFAULT 'es',
  theme TEXT DEFAULT 'oled',
  pin_hash TEXT                 -- NULL = perfil sin PIN, entra de un toque
);

CREATE TABLE IF NOT EXISTS settings (
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (profile_id, key)
);

-- Favoritos por perfil (Tarea 5.3).
-- entity_ref es TEXT porque los ids no son homogéneos: los tipos usan cadenas
-- ('fuego') y el resto enteros. El índice único es lo que hace que pulsar dos
-- veces la estrella no pueda dejar filas duplicadas.
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,     -- 'pokemon' | 'move' | 'ability' | 'type'
  entity_ref TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_unico
  ON favorites (profile_id, entity_type, entity_ref);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,     -- 'pokemon' | 'type' | 'move' | 'ability'
  entity_ref TEXT NOT NULL,
  viewed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Sesiones personalizadas (Radical Red, Elite Redux, ROM Hacks propios...)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  data_json TEXT,                -- overrides de pokemon/tipos/movs/habilidades/relaciones para esta sesión
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Pokémon Champions: modo independiente con su propia base de reglas
CREATE TABLE IF NOT EXISTS champions_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  allowed_pokemon_json TEXT,
  allowed_items_json TEXT,
  allowed_moves_json TEXT,
  allowed_abilities_json TEXT,
  custom_multipliers_json TEXT   -- ej. { "hiper_eficaz": 4 }
);
