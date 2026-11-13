/**
 * PamuDeX — el «ámbito» de los datos de usuario que dependen del juego (Fase 9).
 *
 * Los equipos guardados y las capturas no son del perfil a secas: un equipo de
 * Radical Red no pinta nada en otro ROM Hack, y capturar a Pikachu en uno no lo
 * captura en los demás. El ámbito dice a cuál pertenecen, con el mismo formato
 * que valida `backend/lib/scope.js`:
 *
 *   global          sin sesión ni modo Champions
 *   session:<id>    dentro de esa sesión de ROM Hack
 *   champions:<id>  dentro de ese conjunto de reglas
 *
 * Champions manda sobre la sesión, igual que en `lib/api.ts`: son excluyentes.
 */
import { getActiveChampionsId, useActiveChampions } from "./champions";
import { getActiveSessionId, useActiveSession } from "./session";

export function currentScope(): string {
  const championsId = getActiveChampionsId();
  if (championsId !== null) return `champions:${championsId}`;
  const sessionId = getActiveSessionId();
  return sessionId !== null ? `session:${sessionId}` : "global";
}

/** El ámbito activo, reactivo a los cambios de sesión y de modo. */
export function useScope(): string {
  const [sessionId] = useActiveSession();
  const { champions } = useActiveChampions();
  if (champions) return `champions:${champions.id}`;
  return sessionId !== null ? `session:${sessionId}` : "global";
}
