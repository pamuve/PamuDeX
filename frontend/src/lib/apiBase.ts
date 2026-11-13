/** Base configurable para que el bundle Android contacte con el servidor autoalojado. */
const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
