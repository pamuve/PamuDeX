"use strict";

/**
 * PamuDeX — Tareas 5.1 y 5.2
 * CRUD de perfiles (pantalla inicial estilo Netflix) + PIN opcional.
 *
 * Tabla usada (backend/db/schema.sql):
 *   profiles(id, user_id, name, avatar, color, language, theme, pin_hash)
 *
 * MODELO "UN HOGAR, VARIOS PERFILES"
 * ----------------------------------
 * PamuDeX es autoalojada y de uso doméstico, así que todavía no hay login:
 * `user_id` se guarda como NULL, igual que `sessions.profile_id` en la Fase 3.
 *
 * EL PIN VA EN profiles.pin_hash, NO EN users.password_hash
 * ---------------------------------------------------------
 * Son dos cosas distintas, y los servicios que usan este modelo (Netflix,
 * Disney+, PlayStation) las mantienen separadas:
 *   - `users.password_hash` = credencial de CUENTA. Protege frente al exterior.
 *     Se queda sin usar hasta que exista un login real.
 *   - `profiles.pin_hash`   = bloqueo blando entre CONVIVIENTES.
 * Reusar `users` obligaría a inventar una fila con username falso por perfil,
 * lo que rompe el 1:N cuenta -> perfiles y ensucia la tabla de autenticación.
 *
 * EL HASH NO SALE DE AQUÍ. Ninguna respuesta incluye `pin_hash`; se expone
 * `has_pin` (booleano) para que el frontend pinte el candado.
 *
 * BORRAR UN PERFIL ARRASTRA SUS DATOS
 * -----------------------------------
 * `sessions`, `settings` y `history` referencian `profiles(id)` con
 * ON DELETE CASCADE, y better-sqlite3 activa `PRAGMA foreign_keys` en cada
 * conexión, así que el borrado en cascada SÍ se aplica en caliente. El endpoint
 * DELETE devuelve cuántas sesiones se llevó por delante para que la interfaz
 * pueda avisar antes de que sea tarde.
 *
 * Convención del proyecto: el módulo exporta (db) => router y se monta en server.js.
 */

const express = require("express");
const { isValidPin, hashPin, verifyPin } = require("../lib/pin");
const createThrottle = require("../lib/pinThrottle");

const MAX_NAME = 40;
const MAX_AVATAR = 8; // un emoji puede ocupar varios code units (👨‍👩‍👧 y similares)

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Paleta por defecto. Son los acentos de la paleta OLED del proyecto: ninguno
 * es negro puro ni tan oscuro que el avatar se pierda contra el panel.
 */
const PALETTE = [
  "#7FB4E8", // azul
  "#F85888", // rosa
  "#78C850", // verde
  "#F08030", // naranja
  "#A040A0", // morado
  "#F8D030", // amarillo
  "#6890F0", // índigo
  "#98D8D8", // turquesa
];

const LANGUAGES = ["es", "en"];

/** Recorta y limita un texto libre. Devuelve "" si no es una cadena. */
function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/** Convierte el :id de la URL en entero positivo, o null si no es válido. */
function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Valida un color de perfil. Se exige hexadecimal de 6 dígitos y se prohíbe el
 * negro puro: es la regla innegociable de la paleta OLED del proyecto (provoca
 * estelas al hacer scroll), y aquí además dejaría el avatar invisible.
 */
function isValidColor(value) {
  if (typeof value !== "string" || !HEX.test(value)) return false;
  const r = Number.parseInt(value.slice(1, 3), 16);
  const g = Number.parseInt(value.slice(3, 5), 16);
  const b = Number.parseInt(value.slice(5, 7), 16);
  return r + g + b > 0;
}

module.exports = (db) => {
  const router = express.Router();
  const throttle = createThrottle();

  // NINGUNA de estas consultas selecciona pin_hash: el hash no sale del backend
  // jamás. En su lugar se expone `has_pin`, que es lo único que el frontend
  // necesita para pintar el candado. Para comprobar un PIN está `pinOf`.
  const q = {
    list: db.prepare(
      `SELECT id, user_id, name, avatar, color, language, theme,
              (pin_hash IS NOT NULL) AS has_pin
         FROM profiles
        ORDER BY id ASC`
    ),
    byId: db.prepare(
      `SELECT id, user_id, name, avatar, color, language, theme,
              (pin_hash IS NOT NULL) AS has_pin
         FROM profiles
        WHERE id = ?`
    ),
    pinOf: db.prepare(`SELECT pin_hash FROM profiles WHERE id = ?`),
    setPin: db.prepare(`UPDATE profiles SET pin_hash = ? WHERE id = ?`),
    insert: db.prepare(
      `INSERT INTO profiles (user_id, name, avatar, color, language, theme)
       VALUES (NULL, ?, ?, ?, ?, ?)`
    ),
    update: db.prepare(
      `UPDATE profiles SET name = ?, avatar = ?, color = ?, language = ?, theme = ?
        WHERE id = ?`
    ),
    remove: db.prepare(`DELETE FROM profiles WHERE id = ?`),
    count: db.prepare(`SELECT COUNT(*) AS c FROM profiles`),
    usedColors: db.prepare(`SELECT color FROM profiles`),
    sessionsOf: db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE profile_id = ?`),
  };

  /** SQLite devuelve has_pin como 0/1; la API lo expone como booleano. */
  function toApi(row) {
    if (!row) return row;
    return { ...row, has_pin: Boolean(row.has_pin) };
  }

  /** Primer color de la paleta que nadie esté usando; si están todos, rota. */
  function freeColor() {
    const used = new Set(q.usedColors.all().map((row) => String(row.color || "").toLowerCase()));
    const free = PALETTE.find((c) => !used.has(c.toLowerCase()));
    if (free) return free;
    return PALETTE[q.count.get().c % PALETTE.length];
  }

  // GET /api/profiles -> lista completa (son pocos, no hace falta paginar)
  router.get("/", (req, res) => {
    res.json(q.list.all().map(toApi));
  });

  // GET /api/profiles/palette -> colores sugeridos para el selector del frontend.
  // Va ANTES de /:id para que "palette" no se interprete como un id.
  router.get("/palette", (req, res) => {
    res.json({ palette: PALETTE, suggested: freeColor() });
  });

  // GET /api/profiles/:id
  router.get("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "id_invalido" });

    const row = q.byId.get(id);
    if (!row) return res.status(404).json({ error: "perfil_no_encontrado" });

    res.json(toApi(row));
  });

  // POST /api/profiles -> crea un perfil
  router.post("/", (req, res) => {
    const body = req.body || {};

    const name = cleanText(body.name, MAX_NAME);
    if (!name) return res.status(400).json({ error: "nombre_requerido" });

    const avatar = cleanText(body.avatar, MAX_AVATAR) || null;

    let color = freeColor();
    if (body.color !== undefined && body.color !== null && body.color !== "") {
      if (!isValidColor(body.color)) return res.status(400).json({ error: "color_invalido" });
      color = body.color;
    }

    const language = LANGUAGES.includes(body.language) ? body.language : "es";
    const theme = cleanText(body.theme, 20) || "oled";

    const info = q.insert.run(name, avatar, color, language, theme);
    res.status(201).json(toApi(q.byId.get(info.lastInsertRowid)));
  });

  // PUT /api/profiles/:id -> nombre / avatar / color / idioma / tema.
  // Solo se toca lo que venga en el cuerpo; lo ausente conserva su valor.
  router.put("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "id_invalido" });

    const current = q.byId.get(id);
    if (!current) return res.status(404).json({ error: "perfil_no_encontrado" });

    const body = req.body || {};

    let name = current.name;
    if (body.name !== undefined) {
      name = cleanText(body.name, MAX_NAME);
      if (!name) return res.status(400).json({ error: "nombre_requerido" });
    }

    let avatar = current.avatar;
    if (body.avatar !== undefined) {
      avatar = cleanText(body.avatar, MAX_AVATAR) || null;
    }

    let color = current.color;
    if (body.color !== undefined) {
      if (!isValidColor(body.color)) return res.status(400).json({ error: "color_invalido" });
      color = body.color;
    }

    let language = current.language;
    if (body.language !== undefined) {
      if (!LANGUAGES.includes(body.language)) return res.status(400).json({ error: "idioma_invalido" });
      language = body.language;
    }

    let theme = current.theme;
    if (body.theme !== undefined) {
      theme = cleanText(body.theme, 20) || "oled";
    }

    q.update.run(name, avatar, color, language, theme, id);
    res.json(toApi(q.byId.get(id)));
  });

  // DELETE /api/profiles/:id
  // Devuelve `sessions_borradas` porque el CASCADE se lleva las sesiones del
  // perfil, que son el trabajo de ROM Hack del usuario. La interfaz lo avisa antes.
  router.delete("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "id_invalido" });

    const current = q.byId.get(id);
    if (!current) return res.status(404).json({ error: "perfil_no_encontrado" });

    const sessionsBorradas = q.sessionsOf.get(id).c;
    q.remove.run(id);

    res.json({ ok: true, id, sessions_borradas: sessionsBorradas });
  });

  /* ------------------------------------------------------------------ */
  /* PIN de perfil (Tarea 5.2)                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Comprueba un PIN aplicando el límite de intentos.
   * Devuelve el objeto de respuesta ya listo, o null si el PIN es correcto.
   *
   * Se usa tanto en /verify como al cambiar o quitar el PIN: si solo limitase
   * /verify, la fuerza bruta se haría contra los otros dos endpoints.
   */
  async function checkPinOrError(id, candidate, storedHash) {
    const locked = throttle.check(id);
    if (locked.locked) {
      return {
        status: 429,
        body: { error: "demasiados_intentos", retry_after: locked.retryAfter },
      };
    }

    const ok = typeof candidate === "string" && (await verifyPin(candidate, storedHash));
    if (ok) {
      throttle.reset(id);
      return null;
    }

    const after = throttle.fail(id);
    return {
      status: 401,
      body: {
        error: "pin_incorrecto",
        remaining: after.remaining,
        ...(after.locked ? { retry_after: after.retryAfter } : {}),
      },
    };
  }

  // POST /api/profiles/:id/verify -> comprobar el PIN para entrar en el perfil.
  //
  // Devuelve el MISMO error para "perfil inexistente" y "PIN incorrecto": no
  // debe servir para averiguar qué perfiles existen.
  router.post("/:id/verify", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "id_invalido" });

    const row = q.pinOf.get(id);

    // Perfil inexistente: se responde como un PIN fallido, y además cuenta para
    // el límite de intentos para que tampoco se distinga por el tiempo.
    if (!row) {
      const fail = await checkPinOrError(id, " ", "");
      return res.status(fail.status).json(fail.body);
    }

    // Sin PIN se entra de un toque; el frontend ni siquiera debería llamar aquí.
    if (!row.pin_hash) return res.json({ ok: true, profile: toApi(q.byId.get(id)) });

    const fail = await checkPinOrError(id, req.body && req.body.pin, row.pin_hash);
    if (fail) return res.status(fail.status).json(fail.body);

    res.json({ ok: true, profile: toApi(q.byId.get(id)) });
  });

  // POST /api/profiles/:id/password -> establecer o cambiar el PIN.
  // Si ya había uno, hay que enviar el actual en `current`.
  router.post("/:id/password", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "id_invalido" });

    const row = q.pinOf.get(id);
    if (!row) return res.status(404).json({ error: "perfil_no_encontrado" });

    const body = req.body || {};

    if (!isValidPin(body.pin)) return res.status(400).json({ error: "pin_invalido" });

    if (row.pin_hash) {
      const fail = await checkPinOrError(id, body.current, row.pin_hash);
      if (fail) return res.status(fail.status).json(fail.body);
    }

    q.setPin.run(await hashPin(body.pin), id);
    res.json({ ok: true, profile: toApi(q.byId.get(id)) });
  });

  // DELETE /api/profiles/:id/password -> quitar el PIN. Exige el actual.
  router.delete("/:id/password", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "id_invalido" });

    const row = q.pinOf.get(id);
    if (!row) return res.status(404).json({ error: "perfil_no_encontrado" });
    if (!row.pin_hash) return res.status(400).json({ error: "sin_pin" });

    const fail = await checkPinOrError(id, req.body && req.body.current, row.pin_hash);
    if (fail) return res.status(fail.status).json(fail.body);

    q.setPin.run(null, id);
    res.json({ ok: true, profile: toApi(q.byId.get(id)) });
  });

  return router;
};
