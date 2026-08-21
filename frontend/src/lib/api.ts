// Todas las llamadas pasan por /api, que Vite redirige a Express en dev
// y que en producción sirve el propio contenedor. El Service Worker (StaleWhileRevalidate)
// se encarga de que estas respuestas queden disponibles sin conexión tras la primera sincronización.

import { getActiveSessionId } from "./session";
import { getActiveChampionsId } from "./champions";
import { profilesApi, championsApi } from "./apiSession";
import { leer, guardar } from "./localCache";
import { anotar } from "./perf";

/**
 * Añade el parámetro del modo activo, si hay alguno.
 *
 * - `?champions=<id>` en modo Champions (Fase 6.3).
 * - `?session=<id>` con una sesión de ROM Hack activa (Fase 3).
 *
 * **Nunca los dos**: son modos excluyentes, y Champions manda. Entrar en el
 * modo ya pausa la sesión (`lib/champions.ts`), así que en la práctica no
 * coinciden; esto lo deja garantizado también aquí, y el middleware del backend
 * lo vuelve a garantizar por su cuenta.
 *
 * Sin modo activo la URL sale idéntica a la de la Fase 1, así que los dos
 * middlewares hacen `next()` y la API responde el dato global.
 *
 * Cada modo y cada sesión generan URLs distintas, así que el Service Worker las
 * cachea por separado y el modo offline sigue funcionando en cada uno.
 */
function withMode(path: string): string {
  const sep = path.includes("?") ? "&" : "?";

  const championsId = getActiveChampionsId();
  if (championsId !== null) return `${path}${sep}champions=${championsId}`;

  const sessionId = getActiveSessionId();
  if (sessionId !== null) return `${path}${sep}session=${sessionId}`;

  return path;
}

/**
 * Distingue «el servidor ha dicho que no» de «no he podido preguntar» (8.4).
 *
 * Hasta ahora `get()` lanzaba un `Error` con el código dentro del texto, y las
 * fichas trataban CUALQUIER fallo como un 404. Sin conexión eso hacía que
 * `/pokemon/6` dijese «esta ficha no está permitida en el modo Champions»
 * estando fuera del modo: un mensaje falso justo cuando el usuario más
 * necesita entender qué pasa.
 *
 * `status === 0` es el fallo de red (sin cobertura, servidor caído). Lo demás
 * es una respuesta del servidor con su código.
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, path: string) {
    super(status === 0 ? `Sin conexión al pedir ${path}` : `Error ${status} al pedir ${path}`);
    this.name = "ApiError";
    this.status = status;
  }
}

/** ¿Este fallo es de red y no una respuesta del servidor? */
export function esFalloDeRed(err: unknown): boolean {
  return err instanceof ApiError ? err.status === 0 : true;
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${withMode(path)}`);
  } catch {
    throw new ApiError(0, path);
  }
  if (!res.ok) throw new ApiError(res.status, path);
  return res.json();
}

/**
 * Igual que `get()`, pero pasando por la caché local (Tarea 8.4).
 *
 * LA INTERFAZ NUNCA ESPERA A LA RED SI HAY COPIA LOCAL
 * ----------------------------------------------------
 * Si el catálogo está en IndexedDB se devuelve **al momento** y la red se
 * consulta después, en segundo plano, solo para dejar la copia al día para la
 * próxima vez. Esa es la diferencia con el `StaleWhileRevalidate` del Service
 * Worker: aquél también responde de la caché, pero sigue siendo un `fetch` con
 * su ida y vuelta al worker y su deserialización, y ahí se iban los 100 ms.
 *
 * SE ENCHUFA AQUÍ Y NINGUNA PÁGINA SE ENTERA
 * ------------------------------------------
 * Mismo criterio que los middlewares del backend: `api.types.list()` y compañía
 * se llaman desde media docena de páginas y ninguna cambia. Si algún día hay
 * que dejar de cachear algo, se quita de `RUTAS_CATALOGO` y ya.
 *
 * LA CLAVE ES LA RUTA CON EL MODO DENTRO
 * --------------------------------------
 * `withMode(path)` incluye `?session=` o `?champions=`, así que cada modo tiene
 * su copia. Sin eso, cambiar de ROM Hack serviría el catálogo del anterior.
 */
async function getCatalogo<T>(path: string): Promise<T> {
  const key = withMode(path);
  const inicio = performance.now();

  const guardado = await leer<T>(key);
  if (guardado) {
    anotar(key, "local", inicio);
    // Refresco en segundo plano: no se espera ni se propaga su error. Si falla
    // (sin red), la copia local se queda como estaba, que es lo que se quiere.
    void get<T>(path)
      .then((fresco) => guardar(key, fresco))
      .catch(() => {});
    return guardado.data;
  }

  const fresco = await get<T>(path);
  anotar(key, "red", inicio);
  void guardar(key, fresco);
  return fresco;
}

/**
 * Descarga una ruta del catálogo y devuelve su clave, para la sincronización
 * explícita de `/ajustes`. Vive aquí porque `lib/localCache.ts` no sabe —ni
 * debe saber— construir URLs con el modo activo.
 */
export function descargarParaCache(ruta: string): Promise<{ key: string; data: unknown }> {
  return get<unknown>(ruta).then((data) => ({ key: withMode(ruta), data }));
}

/**
 * Generación pedida en una ficha (Fase 7). `null` o sin valor es «la actual», y
 * entonces la URL sale idéntica a la de siempre: el middleware del backend solo
 * añade `has_generational_differences` y no reescribe nada.
 *
 * Va delante de `withMode`, así que cada combinación de generación y modo
 * genera una URL distinta y el Service Worker las cachea por separado — el modo
 * sin conexión sigue funcionando en cada una.
 */
function genQuery(gen?: number | null): string {
  return gen === null || gen === undefined ? "" : `?gen=${gen}`;
}

export const api = {
  // Los LISTADOS van por `getCatalogo` (8.4): son lo grande y lo que pide casi
  // cada página. Los cuatro de aquí abajo y el de objetos, más abajo. Las
  // FICHAS siguen con `get`: son pequeñas, el Service Worker ya las cubre y
  // cachearlas aquí sería duplicar su trabajo multiplicado por generación y por
  // modo.
  types: {
    list: () => getCatalogo<import("../types").PokeType[]>("/types"),
    // La ficha de tipo es la ÚNICA de detalle que pasa por la caché local: son
    // dieciocho, pesan poco y la tabla de efectividad es el núcleo de la app,
    // así que la descarga explícita de /ajustes las trae todas y funcionan sin
    // conexión aunque no se hayan visitado. Las demás fichas son más de 2200 y
    // se quedan con el Service Worker.
    detail: (id: string, gen?: number | null) =>
      getCatalogo<import("../types").TypeDetail>(`/types/${id}${genQuery(gen)}`),
  },
  pokemon: {
    list: () => getCatalogo<import("../types").PokemonSummary[]>("/pokemon"),
    detail: (id: string | number, gen?: number | null) =>
      get<import("../types").PokemonDetail>(`/pokemon/${id}${genQuery(gen)}`),
  },
  moves: {
    list: () => getCatalogo<import("../types").MoveSummary[]>("/moves"),
    detail: (id: string | number, gen?: number | null) =>
      get<import("../types").MoveDetail>(`/moves/${id}${genQuery(gen)}`),
  },
  abilities: {
    list: () => getCatalogo<import("../types").AbilitySummary[]>("/abilities"),
    detail: (id: string | number, gen?: number | null) =>
      get<import("../types").AbilityDetail>(`/abilities/${id}${genQuery(gen)}`),
  },
  search: (q: string) => get<import("../types").SearchResults>(`/search?q=${encodeURIComponent(q)}`),

  /**
   * Objetos (Tarea 6.0). A diferencia del resto de listados, este admite
   * filtros: son 2151 entradas y el editor de reglas de Champions (6.1) los
   * necesita por categoría para que marcarlos sea manejable.
   *
   * Llevan `?session=` cuando hay sesión activa. Hoy da igual —el middleware de
   * overrides no toca los objetos—, pero mantiene la URL coherente para cuando
   * lo haga, y es también lo que decide la clave de la caché local.
   *
   * SOLO EL LISTADO COMPLETO PASA POR `getCatalogo`. Con filtro la respuesta es
   * un recorte del mismo dato, y guardar una entrada por combinación de
   * `category` y `q` llenaría IndexedDB de trozos que ya están dentro de la
   * lista entera. Los filtrados se quedan con el Service Worker, como las fichas.
   */
  items: {
    list: (opts?: { category?: string; q?: string }) => {
      const params = new URLSearchParams();
      if (opts?.category) params.set("category", opts.category);
      if (opts?.q) params.set("q", opts.q);
      const query = params.toString();
      if (!query) return getCatalogo<import("../types").ItemSummary[]>("/items");
      return get<import("../types").ItemSummary[]>(`/items?${query}`);
    },
    detail: (id: string | number) => get<import("../types").ItemDetail>(`/items/${id}`),
    categories: () => get<import("../types").ItemCategory[]>("/items/categories"),
  },

  /**
   * Perfiles (Fase 5). La implementación vive en `apiSession.ts`, que es donde
   * está el helper capaz de hacer POST/PUT/DELETE; el `get()` de este archivo
   * solo sabe hacer GET y además añade `?session=`, que aquí no queremos.
   * Se expone desde `api` para que las páginas tengan un único punto de entrada.
   */
  profiles: profilesApi,

  /**
   * Pokémon Champions (Tarea 6.1). Como los perfiles, la implementación está en
   * `apiSession.ts` (es la que sabe hacer POST/PUT/DELETE) y se expone aquí para
   * que las páginas tengan un único punto de entrada.
   *
   * Ojo: `champions.pokemon(id)` y compañía devuelven el catálogo YA FILTRADO
   * por ese conjunto de reglas, con la misma forma que `api.pokemon.list()`.
   */
  champions: championsApi,
};
