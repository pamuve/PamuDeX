/**
 * PamuDeX — Fase 9
 * La tabla de tipos completa, 18×18: atacante en filas, defensor en columnas.
 *
 * Sale de `/api/chart`, que ya existía para el editor y devuelve la tabla con
 * los overrides de la sesión activa aplicados. Así que esta es la tabla DEL ROM
 * HACK en el que se esté, no la del juego original.
 *
 * Es una tabla de verdad (`<table>` con `scope`): un lector de pantalla anuncia
 * atacante y defensor en cada celda. En móvil se desplaza en horizontal con la
 * primera columna fija, que es lo que evita perderse en la fila.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, chartApi, type TypeChartResponse } from "../lib/apiSession";
import { LoadError, Loading } from "../components/PageState";
import { readableInk } from "../lib/theme";
import { useI18n } from "../i18n";

/** Clase y texto de una celda según el multiplicador. El x1 se deja en blanco. */
function celda(m: number): { clase: string; texto: string } {
  if (m === 0) return { clase: "bg-ink/20 text-ink font-semibold", texto: "0" };
  if (m >= 2) return { clase: "bg-success/30 text-ink font-semibold", texto: m === 2 ? "2" : String(m) };
  if (m < 1) return { clase: "bg-danger/30 text-ink", texto: m === 0.5 ? "½" : m === 0.25 ? "¼" : String(m) };
  if (m > 1) return { clase: "bg-success/15 text-ink", texto: String(m) };
  return { clase: "text-ink-soft/40", texto: "" };
}

export default function TypeChart() {
  const { t, name } = useI18n();
  const [data, setData] = useState<TypeChartResponse | null>(null);
  const [fallo, setFallo] = useState<"red" | "otro" | null>(null);
  const [reintento, setReintento] = useState(0);
  // Fila y columna resaltadas al tocar una cabecera: en una tabla de 324 celdas
  // es lo que permite seguir una línea con el dedo.
  const [fila, setFila] = useState<string | null>(null);
  const [columna, setColumna] = useState<string | null>(null);

  useEffect(() => {
    setFallo(null);
    let cancelado = false;
    chartApi
      .get()
      .then((d) => !cancelado && setData(d))
      // `ApiError` es que el servidor respondió con un error; lo demás, que no se pudo preguntar.
      .catch((err) => !cancelado && setFallo(err instanceof ApiError ? "otro" : "red"));
    return () => {
      cancelado = true;
    };
  }, [reintento]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-4">
      <div className="space-y-1.5">
        <h1 className="page-title">{t("typechart.title")}</h1>
        <p className="text-sm text-ink-soft max-w-prose">{t("typechart.hint")}</p>
      </div>

      {fallo ? (
        <LoadError heading="h2" offline={fallo === "red"} onRetry={() => setReintento((n) => n + 1)} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft">
            {[2, 0.5, 0].map((m) => (
              <li key={m} className="inline-flex items-center gap-1.5">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded ${celda(m).clase}`}
                  aria-hidden="true"
                >
                  {celda(m).texto}
                </span>
                {t(`typechart.legend.${m === 2 ? "super" : m === 0.5 ? "poco" : "nulo"}`)}
              </li>
            ))}
          </ul>

          {/* `relative`: los textos `sr-only` de las celdas son `absolute`, y sin un
              antecesor posicionado se salen del recorte de este contenedor y le
              dan scroll horizontal a la página entera. */}
          <div className="card relative overflow-auto p-0 max-h-[75vh]">
            <table className="border-separate border-spacing-0 text-center text-sm tabular-nums">
              <caption className="sr-only">{t("typechart.caption")}</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 top-0 z-20 bg-panel p-1.5 text-left text-[0.6875rem] font-normal leading-tight text-ink-soft"
                  >
                    {t("typechart.axis")}
                  </th>
                  {data.types.map((def) => (
                    <th key={def.id} scope="col" className="sticky top-0 z-10 bg-panel p-0.5">
                      <button
                        type="button"
                        onClick={() => setColumna((c) => (c === def.id ? null : def.id))}
                        aria-pressed={columna === def.id}
                        title={name(def)}
                        className="color-chip flex h-9 w-9 items-center justify-center rounded-md text-[0.625rem] font-bold uppercase"
                        style={{
                          backgroundColor: def.color,
                          color: readableInk(def.color),
                          ["--chip-color" as string]: def.color,
                        }}
                      >
                        <span aria-hidden="true">{name(def).slice(0, 3)}</span>
                        <span className="sr-only">{name(def)}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.types.map((atk) => (
                  <tr key={atk.id}>
                    <th scope="row" className="sticky left-0 z-10 bg-panel p-0.5 text-left">
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setFila((f) => (f === atk.id ? null : atk.id))}
                          aria-pressed={fila === atk.id}
                          className="color-chip flex h-9 min-w-[5.5rem] items-center rounded-md px-2 text-xs font-bold uppercase"
                          style={{
                            backgroundColor: atk.color,
                            color: readableInk(atk.color),
                            ["--chip-color" as string]: atk.color,
                          }}
                        >
                          {name(atk)}
                        </button>
                      </span>
                    </th>
                    {data.types.map((def) => {
                      const m = data.chart[atk.id]?.[def.id] ?? 1;
                      const c = celda(m);
                      const resaltada = fila === atk.id || columna === def.id;
                      return (
                        <td key={def.id} className="p-0.5">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-md ${c.clase} ${
                              resaltada ? "ring-1 ring-ink/50" : ""
                            }`}
                          >
                            {/* El x1 no se pinta, pero sí se lee. */}
                            <span aria-hidden="true">{c.texto}</span>
                            <span className="sr-only">×{m}</span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-ink-soft">
            {t("typechart.detailHint")}{" "}
            <Link to="/" className="text-accent underline-offset-2 hover:underline">
              {t("nav.pokedex")}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
