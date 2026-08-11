"use strict";

/**
 * PamuDeX — Tarea 5.2
 * Límite de intentos del PIN, con pausa creciente.
 *
 * Con un PIN de 4 dígitos (10.000 combinaciones), esto es la protección que de
 * verdad importa: sin límite, un script las prueba todas en minutos contra la
 * propia API. Con pausa creciente el ataque deja de ser práctico.
 *
 * El estado vive EN MEMORIA a propósito: es una app doméstica de un solo
 * proceso, y guardarlo en SQLite añadiría escrituras en cada intento fallido
 * sin ganar nada. La contrapartida es que reiniciar el servidor limpia los
 * contadores; para el modelo de amenaza real (un conviviente probando PINs) es
 * irrelevante, y quien pueda reiniciar el proceso ya tiene acceso al archivo.
 */

/** Pausas tras el 5º fallo consecutivo, en segundos. La última se repite. */
const DELAYS = [5, 15, 30, 60, 120, 300];

/** Fallos consecutivos permitidos antes de empezar a bloquear. */
const FREE_ATTEMPTS = 5;

/** Se olvida a un perfil que lleva media hora sin intentos fallidos. */
const FORGET_AFTER_MS = 30 * 60 * 1000;

module.exports = () => {
  /** id de perfil -> { fails, lockUntil, lastSeen } */
  const state = new Map();

  /** Limpia entradas viejas para que el Map no crezca sin control. */
  function sweep(now) {
    for (const [key, entry] of state) {
      if (now - entry.lastSeen > FORGET_AFTER_MS) state.delete(key);
    }
  }

  /**
   * ¿Está bloqueado ahora mismo?
   * Devuelve { locked, retryAfter } con los segundos que faltan.
   */
  function check(id, now = Date.now()) {
    const entry = state.get(id);
    if (!entry || entry.lockUntil <= now) return { locked: false, retryAfter: 0 };
    return { locked: true, retryAfter: Math.ceil((entry.lockUntil - now) / 1000) };
  }

  /**
   * Registra un fallo y devuelve el estado resultante.
   * A partir del 5º fallo consecutivo se bloquea con pausa creciente.
   */
  function fail(id, now = Date.now()) {
    sweep(now);
    const entry = state.get(id) || { fails: 0, lockUntil: 0, lastSeen: now };
    entry.fails += 1;
    entry.lastSeen = now;

    if (entry.fails >= FREE_ATTEMPTS) {
      const step = Math.min(entry.fails - FREE_ATTEMPTS, DELAYS.length - 1);
      entry.lockUntil = now + DELAYS[step] * 1000;
    }
    state.set(id, entry);

    const retryAfter = entry.lockUntil > now ? Math.ceil((entry.lockUntil - now) / 1000) : 0;
    return {
      locked: retryAfter > 0,
      retryAfter,
      remaining: Math.max(0, FREE_ATTEMPTS - entry.fails),
    };
  }

  /** Un acierto borra el historial de fallos del perfil. */
  function reset(id) {
    state.delete(id);
  }

  return { check, fail, reset };
};
