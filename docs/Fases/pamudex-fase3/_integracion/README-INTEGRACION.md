# Integración de la Fase 3 en el repo

Cinco pasos de copiar-pegar y cuatro retoques en archivos que ya existen.
Al final está la lista de comprobación y los puntos que conviene mirar con lupa.

---

## 1. Archivos nuevos (copiar tal cual)

```
backend/lib/overrides.js
backend/lib/typechart.js
backend/middleware/sessionOverrides.js
backend/routes/sessions.js
backend/routes/chart.js

frontend/src/lib/session.ts
frontend/src/lib/apiSession.ts
frontend/src/lib/theme.ts
frontend/src/hooks/useSessionOverride.ts
frontend/src/theme-vars.css
frontend/src/components/SessionRequired.tsx
frontend/src/components/forms/FormField.tsx
frontend/src/components/forms/EntityPicker.tsx
frontend/src/components/forms/PokemonForm.tsx
frontend/src/components/forms/TypeForm.tsx
frontend/src/components/forms/MoveForm.tsx
frontend/src/components/forms/AbilityForm.tsx
frontend/src/components/forms/RelationsMatrix.tsx
frontend/src/components/forms/ThemeForm.tsx
frontend/src/pages/Sessions.tsx
frontend/src/pages/EditorPokemon.tsx
frontend/src/pages/Editor.tsx
```

El zip ya trae esas rutas montadas, así que puedes volcar `backend/` y
`frontend/` encima de tu repo.

---

## 2. `backend/server.js`

```js
const sessionOverrides = require("./middleware/sessionOverrides");
const sessionsRoutes = require("./routes/sessions");
const chartRoutes = require("./routes/chart");

app.use(express.json());               // si no lo tenías ya

// IMPORTANTE: el middleware va ANTES de las rutas de datos.
app.use("/api", sessionOverrides(db));

app.use("/api/sessions", sessionsRoutes(db));
app.use("/api/chart", chartRoutes(db));

// ... aquí siguen tus app.use("/api/types", …), "/api/pokemon", etc.
```

> **ESM**: si tus rutas usan `import` / `export default`, cambia en los cuatro
> archivos nuevos del backend `require(...)` por `import ... from "..."` y
> `module.exports = X` por `export default X`. No hay más diferencias.

---

## 3. `frontend/src/main.tsx`

```tsx
import "./index.css";
import "./theme-vars.css";   // <- añadir, después de index.css
```

---

## 4. `frontend/src/App.tsx`

```tsx
import Sessions from "./pages/Sessions";
import Editor from "./pages/Editor";
import EditorPokemon from "./pages/EditorPokemon";
import { useSessionTheme } from "./lib/theme";

export default function App() {
  useSessionTheme();          // aplica el tema de la sesión activa

  return (
    // ...
    <Routes>
      {/* rutas que ya tenías */}
      <Route path="/sesiones" element={<Sessions />} />
      <Route path="/editor" element={<Editor />} />
      <Route path="/editor/pokemon" element={<EditorPokemon />} />
    </Routes>
  );
}
```

---

## 5. `frontend/src/components/TopBar.tsx`

Al lado del icono de espadas que lleva a `/equipo`:

```tsx
import { Link } from "react-router-dom";
import { Layers, SlidersHorizontal } from "lucide-react";

<Link to="/sesiones" title={t("sessions.nav")} aria-label={t("sessions.nav")}
      className="rounded-lg p-2 text-ink-soft hover:bg-hover hover:text-ink">
  <Layers size={20} aria-hidden="true" />
</Link>

<Link to="/editor" title={t("editor.nav")} aria-label={t("editor.nav")}
      className="rounded-lg p-2 text-ink-soft hover:bg-hover hover:text-ink">
  <SlidersHorizontal size={20} aria-hidden="true" />
</Link>
```

---

## 6. `frontend/src/i18n/es.json` y `en.json`

Añade dentro del objeto raíz los bloques `"sessions"`, `"editor"` y `"theme"`
de `es.fase3.json` / `en.fase3.json`.

> Si tus JSON de i18n son **planos** (`"sessions.title": "Sesiones"`), aplana
> estos bloques antes de pegarlos.

---

## 7. `frontend/tailwind.config.js`

Sustitúyelo por `_integracion/tailwind.config.js`. Si el tuyo tiene plugins,
fuentes o breakpoints propios, cópialos dentro en vez de reemplazarlo entero.
Lo imprescindible: que los colores sean `var(--color-*)` y no hex fijos.

---

## 8. `frontend/src/lib/api.ts` (opcional pero recomendable)

Las páginas nuevas ya usan `lib/apiSession.ts`. Para que la Pokédex, los tipos
y `/equipo` **también** vean los datos de la sesión, localiza el helper de
`fetch` de tu `api.ts` y envuelve la URL:

```ts
import { getActiveSessionId } from "./session";

function withSession(path: string) {
  const id = getActiveSessionId();
  if (id === null) return path;
  return path + (path.includes("?") ? "&" : "?") + `session=${id}`;
}

// donde antes hacías:   fetch(`/api${path}`)
// ahora:                fetch(`/api${withSession(path)}`)
```

Sin este paso, el editor funciona igual pero los cambios solo se ven en la
propia sesión, no en las páginas de consulta.

---

## Comprobación

```bash
cd backend  && npm run dev
cd frontend && npm run build     # debe terminar sin errores
```

A mano, en el navegador:

1. `/sesiones` → crear "Radical Red" → recargar → sigue ahí.
2. `/editor` → pestaña Pokémon → Pikachu → Velocidad 120 → Guardar.
3. `GET /api/pokemon/25?session=1` devuelve `spe: 120`.
4. `GET /api/pokemon/25` (sin `?session`) devuelve el valor original.
5. Pestaña Relaciones → Fuego contra Agua a x2 → `/tipo/fuego?session=1` lo refleja.
6. Pestaña Tema → poner `#000000` → aparece el aviso y no se aplica.
7. Botón "Restaurar valores originales" → vuelve el dato global.

---

## Puntos a mirar con lupa

Estos archivos se escribieron sin ver el código de la Fase 1, así que son los
candidatos a necesitar un ajuste:

| Qué | Por qué | Qué hacer si falla |
|---|---|---|
| `middleware/sessionOverrides.js` | Reconstruye los grupos de efectividad copiando el formato de la respuesta original. Si tu `efectividad` tiene otra forma, no la reconocerá. | Mira una respuesta real de `/api/pokemon/25` y ajusta `rebuildGroups`. |
| `lib/typechart.js` | Intenta leer la tabla `relations`; si no reconoce las columnas usa la tabla canónica de 9.ª gen escrita a mano. | Si tu semilla tiene relaciones no estándar, adapta `loadRelationsFromDb`. |
| `PokemonForm` → `abilities` | Guarda las habilidades como array de cadenas. | Si tu API las devuelve como objetos, ajusta `toNameList` y el `compare`. |
| `MoveForm` → `category` | Normaliza a `physical/special/status`. | Si tu semilla usa `fisico/especial/estado`, cambia `normalizeCategory`. |
| CommonJS vs ESM | El backend está en CommonJS. | Ver la nota del paso 2. |

Ninguno rompe la aplicación si falla: el middleware está envuelto en
`try/catch` y ante un error devuelve el dato global tal cual.
