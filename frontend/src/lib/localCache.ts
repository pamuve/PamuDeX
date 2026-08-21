/**
 * PamuDeX — Tarea 8.4
 * Caché del catálogo en IndexedDB.
 *
 * QUÉ PROBLEMA RESUELVE, Y CUÁL NO
 * ................................
 * El Service Worker ya cacheaba estas respuestas con `StaleWhileRevalidate`,
 * así que la app aguantaba sin conexión. Lo que no daba es el requisito de los
 * **100 ms**: una respuesta del SW sigue siendo un `fetch` con su ida y vuelta
 * al hilo del worker, su deserialización y su cola. Aquí el catálogo se lee de
 * IndexedDB, ya parseado, y se entrega sin tocar la red.
 *
 * SOLO EL CATÁLOGO (los cinco listados)
 * .....................................
 * Tipos, Pokémon, movimientos, habilidades y objetos. Son lo grande y lo que se
 * pide en casi todas las páginas; las fichas sueltas son pequeñas y con el SW
 * van sobradas. Meter aquí todo lo demás sería duplicar el trabajo del SW sin
 * ganar nada.
 *
 * Los objetos entraron con el autocompletado del comparador de equipos: 2151
 * filas que se filtran en local a cada pulsación, exactamente el caso para el
 * que existe esta caché. Solo el listado COMPLETO; `/items?category=` y
 * `/items?q=` —los del editor de reglas de Champions— siguen con el SW, porque
 * cachear cada combinación de filtro llenaría la base de recortes del mismo
 * dato.
 *
 * LA CLAVE LLEVA EL MODO DENTRO, Y ESO NO ES UN DETALLE
 * .....................................................
 * La clave es la ruta COMPLETA que construye `lib/api.ts`, con su `?session=`
 * o `?champions=` incluidos. Guardar `/pokemon` a secas serviría el catálogo de
 * un ROM Hack como si fuera el global —o al revés— en cuanto alguien cambiara
 * de modo, que es exactamente el error que el proyecto lleva evitando desde la
 * Fase 3. Con la ruta entera como clave, cada modo tiene su copia y no hay nada
 * que razonar.
 *
 * POR QUÉ NO SE INVALIDA POR TIEMPO
 * .................................
 * El dataset solo cambia cuando el dueño reconstruye la imagen, y para eso está
 * el aviso de versión nueva de la 8.3. Lo que sí cambia en caliente son los
 * overrides de una sesión de ROM Hack, y esos se invalidan a mano al guardarlos
 * (`invalidarSesion`, que llama `hooks/useSessionOverride.ts`).
 *
 * API nativa, sin `idb`: son cuatro operaciones y no hace falta una dependencia.
 */

export const DB_NAME = "pamudex";
export const DB_VERSION = 1;
export const STORE_CATALOGO = "catalogo";
export const STORE_META = "meta";

/** Rutas que se guardan aquí. El resto sigue yendo por el Service Worker. */
export const RUTAS_CATALOGO = ["/types", "/pokemon", "/moves", "/abilities", "/items"] as const;

export const CACHE_EVENT = "pamudex:cache";

export interface EntradaCatalogo<T = unknown> {
  key: string;
  data: T;
  savedAt: number;
}

let db: Promise<IDBDatabase> | null = null;

function hayIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function abrir(): Promise<IDBDatabase> {
  if (db) return db;
  db = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const base = req.result;
      if (!base.objectStoreNames.contains(STORE_CATALOGO)) {
        base.createObjectStore(STORE_CATALOGO, { keyPath: "key" });
      }
      if (!base.objectStoreNames.contains(STORE_META)) {
        base.createObjectStore(STORE_META);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // Una promesa rechazada cacheada dejaría la caché muerta para siempre.
  db.catch(() => {
    db = null;
  });
  return db;
}

function pedir<T>(store: IDBObjectStore, req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    void store;
  });
}

/** Entrada guardada, o null si no está (o si no hay IndexedDB). */
export async function leer<T>(key: string): Promise<EntradaCatalogo<T> | null> {
  if (!hayIndexedDB()) return null;
  try {
    const base = await abrir();
    const tx = base.transaction(STORE_CATALOGO, "readonly");
    const store = tx.objectStore(STORE_CATALOGO);
    const fila = await pedir<EntradaCatalogo<T> | undefined>(store, store.get(key));
    return fila ?? null;
  } catch {
    return null;
  }
}

export async function guardar<T>(key: string, data: T): Promise<void> {
  if (!hayIndexedDB()) return;
  try {
    const base = await abrir();
    const tx = base.transaction(STORE_CATALOGO, "readwrite");
    tx.objectStore(STORE_CATALOGO).put({ key, data, savedAt: Date.now() });
  } catch {
    // Sin cuota o en modo privado: la app sigue tirando de red y del SW.
  }
}

/** Claves guardadas ahora mismo. */
export async function claves(): Promise<string[]> {
  if (!hayIndexedDB()) return [];
  try {
    const base = await abrir();
    const tx = base.transaction(STORE_CATALOGO, "readonly");
    const store = tx.objectStore(STORE_CATALOGO);
    return (await pedir<IDBValidKey[]>(store, store.getAllKeys())) as string[];
  } catch {
    return [];
  }
}

async function borrarClaves(lista: string[]): Promise<void> {
  if (!lista.length || !hayIndexedDB()) return;
  try {
    const base = await abrir();
    const tx = base.transaction(STORE_CATALOGO, "readwrite");
    const store = tx.objectStore(STORE_CATALOGO);
    for (const k of lista) store.delete(k);
  } catch {
    /* nada que hacer */
  }
}

/**
 * Tira la copia local de una sesión de ROM Hack.
 *
 * La llama `useSessionOverride` justo después de guardar: si no, editar un
 * Pokémon y volver al listado seguiría enseñando el valor viejo, porque la
 * caché responde sin preguntar a nadie.
 */
export async function invalidarSesion(sessionId: number): Promise<void> {
  const marca = `session=${sessionId}`;
  await borrarClaves((await claves()).filter((k) => k.includes(marca)));
  anunciar();
}

/** Vacía la caché entera. */
export async function borrarTodo(): Promise<void> {
  await borrarClaves(await claves());
  await guardarMeta("ultimaSync", null);
  anunciar();
}

/* ------------------------------------------------------------------ */
/* Metadatos: cuándo fue la última sincronización explícita           */
/* ------------------------------------------------------------------ */

async function guardarMeta(clave: string, valor: unknown): Promise<void> {
  if (!hayIndexedDB()) return;
  try {
    const base = await abrir();
    const tx = base.transaction(STORE_META, "readwrite");
    if (valor === null) tx.objectStore(STORE_META).delete(clave);
    else tx.objectStore(STORE_META).put(valor, clave);
  } catch {
    /* nada que hacer */
  }
}

async function leerMeta<T>(clave: string): Promise<T | null> {
  if (!hayIndexedDB()) return null;
  try {
    const base = await abrir();
    const tx = base.transaction(STORE_META, "readonly");
    const store = tx.objectStore(STORE_META);
    const v = await pedir<T | undefined>(store, store.get(clave));
    return v ?? null;
  } catch {
    return null;
  }
}

export function ultimaSincronizacion(): Promise<number | null> {
  return leerMeta<number>("ultimaSync");
}

function anunciar() {
  window.dispatchEvent(new CustomEvent(CACHE_EVENT));
}

/* ------------------------------------------------------------------ */
/* Sincronización explícita (el botón de /ajustes)                    */
/* ------------------------------------------------------------------ */

export interface ProgresoSync {
  hechos: number;
  total: number;
  /** Ruta que se está descargando, para poder decirlo en pantalla. */
  actual: string;
}

/**
 * Descarga el catálogo del modo activo y lo guarda. Secuencial a propósito:
 * son cinco peticiones grandes y en paralelo compiten entre ellas en una
 * conexión mala, que es justo el escenario para el que existe este botón.
 *
 * `descargar` lo inyecta `lib/api.ts` para no crear una dependencia circular:
 * este módulo no sabe construir URLs con el modo, y no debe aprenderlo.
 */
export async function sincronizar(
  descargar: (ruta: string) => Promise<{ key: string; data: unknown }>,
  onProgreso?: (p: ProgresoSync) => void
): Promise<{ ok: number; fallos: string[] }> {
  const fallos: string[] = [];
  let ok = 0;
  let hechos = 0;

  // Las cinco listas primero. La de tipos hay que mirarla después, así que se
  // guarda lo que devuelva.
  let tipos: unknown = null;
  // Total provisional: se corrige en cuanto se sepan cuántos tipos hay.
  let total = RUTAS_CATALOGO.length;

  const paso = async (ruta: string) => {
    onProgreso?.({ hechos, total, actual: ruta });
    try {
      const { key, data } = await descargar(ruta);
      await guardar(key, data);
      ok++;
      return data;
    } catch {
      fallos.push(ruta);
      return null;
    } finally {
      hechos++;
    }
  };

  for (const ruta of RUTAS_CATALOGO) {
    const data = await paso(ruta);
    if (ruta === "/types") tipos = data;
  }

  /*
   * Y además las FICHAS de cada tipo, que son dieciocho y pesan poco.
   *
   * Es la única excepción a «aquí solo van los listados», y tiene motivo: la
   * tabla de efectividad es el núcleo de la app, y sin esto la ficha de un tipo
   * que no se hubiera visitado antes no abría sin conexión. Las fichas de
   * Pokémon, movimientos y habilidades NO se descargan: son más de 2200
   * peticiones y decenas de megas, así que esas siguen dependiendo de que se
   * hayan visitado (el Service Worker las guarda al pasar por ellas).
   */
  if (Array.isArray(tipos)) {
    const ids = tipos
      .map((t) => (t && typeof t === "object" ? (t as { id?: unknown }).id : null))
      .filter((id): id is string => typeof id === "string");
    total += ids.length;
    for (const id of ids) await paso(`/types/${id}`);
  }

  onProgreso?.({ hechos: total, total, actual: "" });
  if (ok > 0) await guardarMeta("ultimaSync", Date.now());
  anunciar();
  return { ok, fallos };
}
