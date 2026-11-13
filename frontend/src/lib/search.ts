/**
 * PamuDeX — búsqueda local sobre el catálogo.
 *
 * POR QUÉ NO SE PREGUNTA AL SERVIDOR
 * ----------------------------------
 * El buscador de la portada llamaba a `/api/search` en cada pulsación. En una
 * app offline-first eso tenía dos problemas:
 *
 *  - Sin conexión solo funcionaban las búsquedas EXACTAS que ya se hubieran
 *    hecho antes (las que el Service Worker tenía guardadas). Escribir un
 *    nombre nuevo en modo avión daba error, aunque el catálogo entero estuviera
 *    descargado en el aparato.
 *  - Con conexión, una ida y vuelta por letra para filtrar unos datos que la
 *    app ya tiene en memoria.
 *
 * Los cuatro listados pasan por `getCatalogo` (IndexedDB + memoria), así que
 * aquí se filtra en local: responde al instante y funciona sin red en cuanto el
 * catálogo se ha visto una vez.
 *
 * RESPETA EL MODO ACTIVO SIN HACER NADA: los listados ya vienen con los
 * overrides de la sesión o filtrados por Champions. De paso arregla un detalle
 * del servidor, que buscaba por el nombre ORIGINAL y aplicaba el override
 * después: un Pokémon renombrado en un ROM Hack no se encontraba por su nombre
 * nuevo.
 *
 * `/api/search` sigue existiendo en el backend para quien use la API.
 */
import { api } from "./api";
import type { SearchResults } from "../types";

const LIMITE = 8;

/** Minúsculas y sin tildes: «flabebe» encuentra a Flabébé y «psiquico» a Psíquico. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

interface Nombrable {
  name_es: string;
  name_en?: string | null;
}

/**
 * Los nombres ya normalizados de cada listado, calculados una vez. La clave es
 * el propio array: `getCatalogo` devuelve siempre el mismo mientras no se
 * refresque, y cuando cambia el índice viejo se va con él (WeakMap).
 */
const indices = new WeakMap<object, [string, string][]>();

function indiceDe(lista: Nombrable[]): [string, string][] {
  let indice = indices.get(lista);
  if (!indice) {
    indice = lista.map((x) => [normalizar(x.name_es), normalizar(x.name_en || "")]);
    indices.set(lista, indice);
  }
  return indice;
}

/** Primero lo que EMPIEZA por el texto, luego lo que lo contiene. */
function filtrar<T extends Nombrable>(lista: T[], texto: string): T[] {
  const indice = indiceDe(lista);
  const empiezan: T[] = [];
  const contienen: T[] = [];
  for (let i = 0; i < lista.length; i++) {
    const [es, en] = indice[i];
    if (es.startsWith(texto) || en.startsWith(texto)) {
      empiezan.push(lista[i]);
      if (empiezan.length === LIMITE) return empiezan;
    } else if (contienen.length < LIMITE && (es.includes(texto) || en.includes(texto))) {
      contienen.push(lista[i]);
    }
  }
  return empiezan.concat(contienen).slice(0, LIMITE);
}

/** Deja los listados en memoria para que la primera letra ya responda al momento. */
export function precargarBusqueda(): void {
  void Promise.all([api.pokemon.list(), api.types.list(), api.moves.list(), api.abilities.list()]).catch(
    () => {}
  );
}

export async function buscar(q: string): Promise<SearchResults> {
  const texto = normalizar(q.trim());
  if (!texto) return { pokemon: [], types: [], moves: [], abilities: [] };

  const [pokemon, types, moves, abilities] = await Promise.all([
    api.pokemon.list(),
    api.types.list(),
    api.moves.list(),
    api.abilities.list(),
  ]);

  return {
    pokemon: filtrar(pokemon, texto),
    types: filtrar(types, texto),
    moves: filtrar(moves, texto),
    abilities: filtrar(abilities, texto),
  };
}
