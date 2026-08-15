/**
 * PamuDeX — Tarea 8.3
 * Notificaciones opcionales del sistema.
 *
 * DESACTIVADAS POR DEFECTO, Y EL PERMISO SOLO SE PIDE AL ACTIVARLAS
 * ................................................................
 * La app **nunca** llama a `Notification.requestPermission()` por su cuenta.
 * Pedirlo al cargar es la práctica que ha hecho que medio mundo bloquee las
 * notificaciones a ciegas, y además en Chrome un rechazo deja el permiso en
 * `denied` de forma permanente: se gasta la única oportunidad sin que el
 * usuario supiera para qué. Aquí solo se pide desde el interruptor de
 * `/ajustes`, que es un gesto explícito y con el motivo delante.
 *
 * PARA QUÉ SIRVEN, EXACTAMENTE
 * ............................
 * Para un caso y de momento solo uno: avisar de que hay una versión nueva de
 * la app lista para aplicarse. Es útil porque puede pasar con la pestaña en
 * segundo plano, que es cuando un aviso dentro de la página no se ve. Todo lo
 * demás que hace PamuDeX ocurre mientras la estás mirando y no necesita sacar
 * al usuario de donde esté.
 *
 * NO son notificaciones push: no hay servidor que las mande ni suscripción que
 * mantener. Las dispara la propia página cuando el service worker le dice que
 * hay una versión esperando.
 *
 * POR QUÉ ES UNA PREFERENCIA DEL APARATO Y NO DEL PERFIL
 * .....................................................
 * A diferencia del alto contraste (8.1), esto NO se copia en `settings`. El
 * permiso que necesita lo concede el navegador al sitio entero, no a un perfil:
 * tener el interruptor por perfil daría la falsa impresión de que apagarlo en
 * uno revoca algo, cuando el permiso seguiría concedido. Una sola preferencia
 * por navegador es lo que se corresponde con la realidad de debajo.
 */

import { useCallback, useEffect, useState } from "react";

export const NOTIFICATIONS_KEY = "pamudex_notifications";
export const NOTIFICATIONS_EVENT = "pamudex:notifications";

/** Etiqueta fija: si ya hay un aviso de actualización, se sustituye, no se apila. */
const TAG_ACTUALIZACION = "pamudex-actualizacion";

/**
 * Estado del permiso del navegador.
 *  - `unsupported`: el navegador no tiene la API (o no hay contexto seguro).
 *  - `default`: todavía no se ha preguntado.
 *  - `granted` / `denied`: ya está decidido.
 */
export type PermisoNotificaciones = "unsupported" | "default" | "granted" | "denied";

export function soportaNotificaciones(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function permisoActual(): PermisoNotificaciones {
  if (!soportaNotificaciones()) return "unsupported";
  return Notification.permission as PermisoNotificaciones;
}

/** ¿Las quiere el usuario en ESTE navegador? Por defecto, no. */
export function notificacionesActivadas(): boolean {
  try {
    return localStorage.getItem(NOTIFICATIONS_KEY) === "1";
  } catch {
    return false;
  }
}

function anunciar() {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_EVENT));
}

function guardar(valor: boolean) {
  try {
    if (valor) localStorage.setItem(NOTIFICATIONS_KEY, "1");
    else localStorage.removeItem(NOTIFICATIONS_KEY);
  } catch {
    /* modo privado: vale para esta sesión y no se recuerda */
  }
  anunciar();
}

/**
 * Activa las notificaciones pidiendo permiso si hace falta.
 * **Llamar solo desde un gesto del usuario.** Devuelve el permiso resultante,
 * para que la pantalla explique qué ha pasado sin volver a preguntar.
 */
export async function activarNotificaciones(): Promise<PermisoNotificaciones> {
  if (!soportaNotificaciones()) return "unsupported";

  let permiso = permisoActual();
  if (permiso === "default") {
    try {
      permiso = (await Notification.requestPermission()) as PermisoNotificaciones;
    } catch {
      return permisoActual();
    }
  }

  // Con el permiso denegado NO se guarda el interruptor como activado: sería
  // mentirle al usuario, porque no va a llegar ningún aviso. Revertirlo hay
  // que hacerlo en los ajustes del navegador, y eso lo explica la pantalla.
  guardar(permiso === "granted");
  return permiso;
}

export function desactivarNotificaciones(): void {
  guardar(false);
}

/**
 * Lanza una notificación si procede. Devuelve si se ha llegado a mostrar.
 *
 * Prefiere el service worker a `new Notification()`: en Chrome para Android el
 * constructor lanza `TypeError` y solo funciona `showNotification` desde el
 * registro del SW.
 */
export async function notificar(
  titulo: string,
  cuerpo: string,
  tag = TAG_ACTUALIZACION
): Promise<boolean> {
  if (!notificacionesActivadas() || permisoActual() !== "granted") return false;

  const opciones: NotificationOptions = {
    body: cuerpo,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag,
  };

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(titulo, opciones);
        return true;
      }
    }
    new Notification(titulo, opciones);
    return true;
  } catch {
    return false;
  }
}

/** Estado de las notificaciones para la pantalla que las configura. */
export function useNotifications() {
  const [activadas, setActivadas] = useState(() => notificacionesActivadas());
  const [permiso, setPermiso] = useState<PermisoNotificaciones>(() => permisoActual());

  useEffect(() => {
    const sync = () => {
      setActivadas(notificacionesActivadas());
      setPermiso(permisoActual());
    };
    window.addEventListener(NOTIFICATIONS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(NOTIFICATIONS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const alternar = useCallback(async () => {
    if (notificacionesActivadas()) {
      desactivarNotificaciones();
      setActivadas(false);
      return permisoActual();
    }
    const resultado = await activarNotificaciones();
    setActivadas(notificacionesActivadas());
    setPermiso(resultado);
    return resultado;
  }, []);

  return { activadas, permiso, alternar };
}
