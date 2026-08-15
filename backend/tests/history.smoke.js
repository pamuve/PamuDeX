/**
 * Prueba de humo del historial y los ajustes por perfil (Tarea 5.4), con `db`,
 * `req` y `res` simulados. No forma parte del entregable: sirve para verificar
 * la lógica sin arrancar el servidor ni SQLite.
 *
 * Lo que de verdad se comprueba aquí es la ventana de deduplicación de 5
 * minutos, que es la única regla del proyecto que NO puede delegarse en la base
 * de datos (`history` no lleva índice único, y no debe llevarlo). El reloj es
 * simulado, así que "esperar seis minutos" no cuesta seis minutos.
 */

const assert = require("assert");
const historyRoute = require("../routes/history");
const settingsRoute = require("../routes/settings");

/* ---------------------------------------------------------------- */
/* Base de datos simulada                                            */
/* ---------------------------------------------------------------- */

/** Reloj simulado, en milisegundos. Se mueve con `avanzarMinutos()`. */
let AHORA = Date.UTC(2026, 0, 1, 12, 0, 0);
const avanzarMinutos = (m) => (AHORA += m * 60 * 1000);
const comoTexto = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

/** Perfiles existentes, para el 404 de perfil_no_encontrado. */
const PERFILES = new Set([1, 2]);

let historyRows = [];
let settingsRows = [];
let nextId = 1;

/** Convierte '-5 minutes' en milisegundos. */
function modificadorEnMs(mod) {
  const match = /^-(\d+) minutes$/.exec(String(mod));
  assert.ok(match, `modificador de tiempo no reconocido: ${mod}`);
  return Number(match[1]) * 60 * 1000;
}

const fakeDb = {
  transaction(fn) {
    // better-sqlite3 devuelve una función que ejecuta `fn` dentro de una
    // transacción. Aquí basta con ejecutarla: lo que se prueba es la validación
    // previa, no el aislamiento de SQLite.
    return (...args) => fn(...args);
  },

  prepare(sql) {
    /* --- profiles ------------------------------------------------ */
    if (sql.includes("FROM profiles")) {
      return { get: (id) => (PERFILES.has(id) ? { 1: 1 } : undefined) };
    }

    /* --- history ------------------------------------------------- */
    if (sql.includes("INSERT INTO history")) {
      return {
        run: (profileId, entityType, entityRef) => {
          const id = nextId++;
          historyRows.push({
            id,
            profile_id: profileId,
            entity_type: entityType,
            entity_ref: entityRef,
            viewed_at: comoTexto(AHORA),
            _ts: AHORA,
          });
          return { lastInsertRowid: id, changes: 1 };
        },
      };
    }
    if (sql.includes("datetime('now', ?)")) {
      return {
        get: (profileId, entityType, entityRef, mod) => {
          const limite = AHORA - modificadorEnMs(mod);
          return historyRows
            .filter(
              (r) =>
                r.profile_id === profileId &&
                r.entity_type === entityType &&
                r.entity_ref === entityRef &&
                r._ts > limite
            )
            .sort((a, b) => b._ts - a._ts)[0];
        },
      };
    }
    // La poda va ANTES que el listado: su subconsulta también dice
    // "SELECT id FROM history ... LIMIT ?", así que encajaría con él.
    if (sql.includes("DELETE FROM history") && sql.includes("NOT IN")) {
      return {
        run: (profileId, _mismo, max) => {
          const conservar = new Set(
            historyRows
              .filter((r) => r.profile_id === profileId)
              .sort((a, b) => b._ts - a._ts || b.id - a.id)
              .slice(0, max)
              .map((r) => r.id)
          );
          const antes = historyRows.length;
          historyRows = historyRows.filter(
            (r) => r.profile_id !== profileId || conservar.has(r.id)
          );
          return { changes: antes - historyRows.length };
        },
      };
    }
    if (sql.includes("DELETE FROM history")) {
      return {
        run: (profileId) => {
          const antes = historyRows.length;
          historyRows = historyRows.filter((r) => r.profile_id !== profileId);
          return { changes: antes - historyRows.length };
        },
      };
    }
    if (sql.includes("COUNT(*)") && sql.includes("FROM history")) {
      return {
        get: (profileId) => ({ c: historyRows.filter((r) => r.profile_id === profileId).length }),
      };
    }
    if (sql.includes("FROM history") && sql.includes("LIMIT ?")) {
      return {
        all: (profileId, limit) =>
          historyRows
            .filter((r) => r.profile_id === profileId)
            .sort((a, b) => b._ts - a._ts || b.id - a.id)
            .slice(0, limit)
            .map(({ id, entity_type, entity_ref, viewed_at }) => ({
              id,
              entity_type,
              entity_ref,
              viewed_at,
            })),
      };
    }

    /* --- settings ------------------------------------------------ */
    if (sql.includes("INSERT INTO settings")) {
      return {
        run: (profileId, key, value) => {
          const found = settingsRows.find((r) => r.profile_id === profileId && r.key === key);
          if (found) found.value = value;
          else settingsRows.push({ profile_id: profileId, key, value });
          return { changes: 1 };
        },
      };
    }
    if (sql.includes("DELETE FROM settings")) {
      return {
        run: (profileId, key) => {
          const antes = settingsRows.length;
          settingsRows = settingsRows.filter(
            (r) => !(r.profile_id === profileId && r.key === key)
          );
          return { changes: antes - settingsRows.length };
        },
      };
    }
    if (sql.includes("FROM settings")) {
      return {
        all: (profileId) =>
          settingsRows
            .filter((r) => r.profile_id === profileId)
            .map(({ key, value }) => ({ key, value })),
      };
    }

    throw new Error("consulta no simulada: " + sql);
  },
};

/* ---------------------------------------------------------------- */
/* Invocación de las rutas                                           */
/* ---------------------------------------------------------------- */

const history = historyRoute(fakeDb);
const settings = settingsRoute(fakeDb);

/**
 * Ejecuta una petición contra un router de Express y devuelve
 * `{ status, body }`. El router es un middleware normal, así que se puede
 * llamar a mano sin levantar el servidor.
 */
function pedir(router, method, url, { query = {}, params = {}, body } = {}) {
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

  const req = { method, url, originalUrl: url, query, params, body, headers: {} };

  router(req, res, () => {
    throw new Error(`ninguna ruta atendió ${method} ${url}`);
  });

  return { status, body: payload };
}

const verVisita = (profile, entity_type, entity_ref) =>
  pedir(history, "POST", "/", { query: { profile: String(profile) }, body: { entity_type, entity_ref } });

/* ================================================================ */
/* 1. Primera visita: se registra                                    */
/* ================================================================ */
let r = verVisita(1, "pokemon", 25);
assert.strictEqual(r.status, 200);
assert.strictEqual(r.body.registrado, true);
assert.strictEqual(r.body.entity_ref, "25", "la referencia se normaliza a cadena");
console.log("1 OK  primera visita registrada");

/* ================================================================ */
/* 2. Repetirla al momento NO crea un duplicado                      */
/* ================================================================ */
r = verVisita(1, "pokemon", 25);
assert.strictEqual(r.body.registrado, false);
assert.strictEqual(r.body.motivo, "duplicado_reciente");

// Y da igual que llegue como número o como cadena: '25' y 25 son la misma ficha.
r = verVisita(1, "pokemon", "25");
assert.strictEqual(r.body.registrado, false, "'25' y 25 deben deduplicarse igual");

avanzarMinutos(4);
r = verVisita(1, "pokemon", 25);
assert.strictEqual(r.body.registrado, false, "dentro de la ventana de 5 minutos");
assert.strictEqual(historyRows.length, 1);
console.log("2 OK  deduplicación dentro de la ventana de 5 minutos");

/* ================================================================ */
/* 3. Pasada la ventana, la misma ficha vuelve a registrarse         */
/* ================================================================ */
avanzarMinutos(2); // 6 minutos desde la última visita registrada
r = verVisita(1, "pokemon", 25);
assert.strictEqual(r.body.registrado, true);
assert.strictEqual(historyRows.length, 2, "el historial es una bitácora, no un conjunto");
console.log("3 OK  pasada la ventana se registra otra vez");

/* ================================================================ */
/* 4. La deduplicación es POR ENTIDAD, no global                     */
/* ================================================================ */
r = verVisita(1, "type", "fuego");
assert.strictEqual(r.body.registrado, true, "otra entidad se registra al momento");
r = verVisita(1, "move", 6);
assert.strictEqual(r.body.registrado, true);
console.log("4 OK  la ventana es por entidad, no global");

/* ================================================================ */
/* 5. Cada perfil tiene su propio historial                          */
/* ================================================================ */
r = verVisita(2, "pokemon", 25);
assert.strictEqual(r.body.registrado, true, "otro perfil no comparte la ventana");

const delPerfil2 = pedir(history, "GET", "/", { query: { profile: "2" } });
assert.strictEqual(delPerfil2.body.items.length, 1);
console.log("5 OK  historiales independientes por perfil");

/* ================================================================ */
/* 6. GET: orden cronológico inverso y límite                        */
/* ================================================================ */
const lista = pedir(history, "GET", "/", { query: { profile: "1" } });
assert.strictEqual(lista.body.limit, 50, "límite por defecto");
assert.strictEqual(lista.body.items.length, 4);
assert.strictEqual(lista.body.items[0].entity_type, "move", "lo más reciente primero");

const limitada = pedir(history, "GET", "/", { query: { profile: "1", limit: "2" } });
assert.strictEqual(limitada.body.items.length, 2);

const tope = pedir(history, "GET", "/", { query: { profile: "1", limit: "9999" } });
assert.strictEqual(tope.body.limit, 200, "el límite se recorta al máximo");
console.log("6 OK  GET ordenado, con límite y tope");

/* ================================================================ */
/* 7. Errores de validación                                          */
/* ================================================================ */
assert.strictEqual(pedir(history, "GET", "/", { query: {} }).status, 400);
assert.strictEqual(pedir(history, "GET", "/", { query: { profile: "99" } }).status, 404);

r = pedir(history, "POST", "/", {
  query: { profile: "1" },
  body: { entity_type: "item", entity_ref: 1 },
});
assert.strictEqual(r.status, 400);
assert.strictEqual(r.body.error, "tipo_invalido");

r = pedir(history, "POST", "/", { query: { profile: "1" }, body: { entity_type: "pokemon" } });
assert.strictEqual(r.body.error, "referencia_requerida");
console.log("7 OK  validación de perfil, tipo y referencia");

/* ================================================================ */
/* 8. El historial tiene techo (poda tras insertar)                  */
/* ================================================================ */
const MAX = historyRoute.MAX_ROWS;
for (let i = 0; i < MAX + 20; i++) {
  avanzarMinutos(10); // fuera de la ventana, para que todas cuenten
  verVisita(2, "pokemon", 1000 + i);
}
const delPerfil2Tras = historyRows.filter((row) => row.profile_id === 2).length;
assert.strictEqual(delPerfil2Tras, MAX, `se conservan como mucho ${MAX} visitas por perfil`);
assert.ok(
  historyRows.some((row) => row.profile_id === 1),
  "la poda no toca a los demás perfiles"
);
console.log(`8 OK  poda a ${MAX} visitas por perfil`);

/* ================================================================ */
/* 9. DELETE limpia el historial del perfil                          */
/* ================================================================ */
const borrado = pedir(history, "DELETE", "/", { query: { profile: "1" } });
assert.strictEqual(borrado.body.borradas, 4);
assert.strictEqual(historyRows.filter((row) => row.profile_id === 1).length, 0);
assert.ok(historyRows.length > 0, "el historial del otro perfil sigue intacto");
console.log("9 OK  DELETE limpia solo el perfil indicado");

/* ================================================================ */
/* 10. Ajustes: valores por defecto, fusión y borrado                */
/* ================================================================ */
let s = pedir(settings, "GET", "/1", { params: { profileId: "1" } });
assert.deepStrictEqual(s.body.settings, settingsRoute.DEFAULTS, "sin nada guardado, los defectos");

s = pedir(settings, "PUT", "/1", { params: { profileId: "1" }, body: { history_enabled: false } });
assert.strictEqual(s.body.settings.history_enabled, "0", "los booleanos se guardan como 1/0");
assert.strictEqual(s.body.settings.active_session, "", "lo que no viene conserva su valor");

s = pedir(settings, "PUT", "/1", { params: { profileId: "1" }, body: { active_session: 3 } });
assert.strictEqual(s.body.settings.active_session, "3");
assert.strictEqual(s.body.settings.history_enabled, "0", "PUT fusiona, no reemplaza");

s = pedir(settings, "PUT", "/1", { params: { profileId: "1" }, body: { active_session: null } });
assert.strictEqual(s.body.settings.active_session, "", "null borra la clave");

// Los ajustes son del perfil, no globales: el criterio de aceptación de la 5.4.
s = pedir(settings, "GET", "/2", { params: { profileId: "2" } });
assert.strictEqual(s.body.settings.history_enabled, "1", "el perfil 2 no hereda nada del 1");
console.log("10 OK  ajustes con valores por defecto, fusión y borrado");

/* ================================================================ */
/* 11. Ajustes: lista blanca de claves                               */
/* ================================================================ */
s = pedir(settings, "PUT", "/1", { params: { profileId: "1" }, body: { color_favorito: "#FF0000" } });
assert.strictEqual(s.status, 400);
assert.strictEqual(s.body.error, "clave_invalida");
assert.strictEqual(s.body.key, "color_favorito");

// El idioma NO se guarda aquí: vive en profiles.language (decisión de la 5.4).
s = pedir(settings, "PUT", "/1", { params: { profileId: "1" }, body: { language: "en" } });
assert.strictEqual(s.body.error, "clave_invalida", "el idioma va en profiles.language");

assert.strictEqual(pedir(settings, "PUT", "/1", { params: { profileId: "1" }, body: {} }).status, 400);
assert.strictEqual(pedir(settings, "GET", "/99", { params: { profileId: "99" } }).status, 404);
console.log("11 OK  lista blanca de claves y errores de ajustes");

/* ================================================================ */
/* 12. Ajustes: accesibilidad (Tarea 8.1)                            */
/* ================================================================ */
// Por defecto la app NO está en alto contraste ni escalada: activarlos es una
// decisión explícita del usuario, nunca algo que se herede sin pedirlo.
s = pedir(settings, "GET", "/2", { params: { profileId: "2" } });
assert.strictEqual(s.body.settings.high_contrast, "0", "el alto contraste viene apagado");
assert.strictEqual(s.body.settings.text_scale, "100", "el texto viene sin escalar");

s = pedir(settings, "PUT", "/2", {
  params: { profileId: "2" },
  body: { high_contrast: true, text_scale: 130 },
});
assert.strictEqual(s.body.settings.high_contrast, "1", "el booleano se guarda como 1/0");
assert.strictEqual(s.body.settings.text_scale, "130", "el número se guarda como texto");

// Son del perfil, igual que el resto: la accesibilidad de uno no se le impone al otro.
s = pedir(settings, "GET", "/1", { params: { profileId: "1" } });
assert.strictEqual(s.body.settings.high_contrast, "0", "el perfil 1 no hereda el alto contraste");

s = pedir(settings, "PUT", "/2", { params: { profileId: "2" }, body: { text_scale: null } });
assert.strictEqual(s.body.settings.text_scale, "100", "null devuelve el escalado a su defecto");
console.log("12 OK  alto contraste y escalado de texto por perfil");

console.log("\nTodas las pruebas pasan.");
