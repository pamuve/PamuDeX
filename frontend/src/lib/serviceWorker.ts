/**
 * PamuDeX — Tarea 8.3
 * Registro del service worker y detección de versión nueva.
 *
 * POR QUÉ NO SE USA `virtual:pwa-register/react`
 * ..............................................
 * El módulo virtual que ofrece `vite-plugin-pwa` importa `workbox-window`, que
 * no está instalado: usarlo obliga a añadir una dependencia de tiempo de
 * ejecución más. Lo que aporta sobre esto son comprobaciones periódicas que
 * aquí no interesan (la app es autoalojada: la versión nueva llega cuando el
 * dueño reconstruye la imagen, no cada hora), así que se hace con la API
 * estándar `navigator.serviceWorker`, que son treinta líneas y ninguna
 * dependencia. `pnpm run build` seguía fallando con el módulo virtual por ese
 * import sin resolver.
 *
 * CÓMO SE DETECTA QUE HAY UNA VERSIÓN ESPERANDO
 * .............................................
 * Un service worker nuevo se queda en estado `waiting` mientras la versión
 * anterior siga controlando la página. Eso es exactamente «hay una versión
 * lista para aplicarse», y hay tres formas de llegar a ese estado:
 *
 *  1. ya estaba esperando cuando se abrió la app (`registration.waiting`);
 *  2. aparece mientras la app está abierta (`updatefound` -> `installed`);
 *  3. lo instala otra pestaña (`waiting` en un `getRegistration` posterior).
 *
 * La condición `navigator.serviceWorker.controller !== null` distingue una
 * ACTUALIZACIÓN de la primera instalación: sin controlador, ese worker
 * «esperando» es en realidad la primera vez que se instala la app y no hay nada
 * que avisar.
 *
 * AL APLICARLA, LA PÁGINA SE RECARGA UNA SOLA VEZ
 * ...............................................
 * `SKIP_WAITING` hace que el worker nuevo tome el control, y eso dispara
 * `controllerchange`. Sin el cerrojo `recargando`, un `controllerchange` que
 * llegue por otro motivo (otra pestaña aplicando la actualización) metería la
 * página en un bucle de recargas.
 */

export const SW_UPDATE_EVENT = "pamudex:sw-update";

let esperando: ServiceWorker | null = null;
let recargando = false;

function avisar(worker: ServiceWorker) {
  esperando = worker;
  window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT));
}

/** ¿Hay una versión instalada esperando a que se le dé permiso? */
export function hayActualizacion(): boolean {
  return esperando !== null;
}

/**
 * Aplica la versión que está esperando. La página se recarga sola cuando el
 * worker nuevo toma el control.
 */
export function aplicarActualizacion(): void {
  if (!esperando) return;
  esperando.postMessage({ type: "SKIP_WAITING" });
}

/** Descarta el aviso hasta la próxima vez que se abra la app. */
export function descartarActualizacion(): void {
  esperando = null;
  window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT));
}

/**
 * Registra el service worker. Se llama UNA vez, desde `main.tsx`.
 *
 * En desarrollo no se registra nada: un service worker sirviendo el shell
 * cacheado se pelea con el recambio en caliente de Vite.
 */
export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recargando) return;
    recargando = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registro) => {
        // Caso 1: ya había una versión esperando al abrir.
        if (registro.waiting && navigator.serviceWorker.controller) {
          avisar(registro.waiting);
        }

        // Caso 2: aparece con la app abierta.
        registro.addEventListener("updatefound", () => {
          const nuevo = registro.installing;
          if (!nuevo) return;
          nuevo.addEventListener("statechange", () => {
            // Sin controlador es la PRIMERA instalación, no una actualización.
            if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
              avisar(nuevo);
            }
          });
        });
      })
      .catch(() => {
        // Sin service worker la app sigue funcionando: solo pierde el uso
        // offline y el aviso de versión nueva.
      });
  });
}
