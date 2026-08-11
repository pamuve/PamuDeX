# Fase 6 — Terreno preparado y decisiones que hay que tomar antes de la 6.1

> No es una tarea: es la nota previa a la fase, igual que las «tres decisiones»
> que precedieron a la 5.4. Léela antes de encargar `06-01`, y pégala junto a
> `_CONTEXTO_BASE.md` si la IA que va a hacer la 6.1 no tiene contexto del repo.

Los encargos `06-01`, `06-02` y `06-03` se escribieron antes de que existieran
las fases 3, 4 y 5. Al llegar aquí, el repo ya resuelve varios de sus problemas
de otra manera, y hay un dato que sencillamente no existe. Esto es lo que hay
que decidir **antes** de escribir código, no a mitad.

---

## 1. ¿Cómo llega el filtro de Champions a la API?

El encargo 6.1 pide endpoints propios (`GET /api/champions/:id/pokemon`,
`/moves`, `/abilities`). El 6.3 pide que `lib/api.ts` «apunte a los endpoints de
Champions» cuando el modo está activo, **reutilizando las mismas páginas de
ficha**. Cumplir las dos cosas a la vez con rutas duplicadas obliga a mantener
dos versiones de cada endpoint de detalle (`/champions/:id/pokemon/:pokeId`…),
que es justo lo que la Fase 3 evitó.

**Recomendación: repetir el patrón del middleware.** `?champions=<id>` en la
query y un `middleware/championsFilter.js` montado como `sessionOverrides`, que
intercepta `res.json` y descarta lo no permitido. Con eso, **todas** las rutas de
datos que ya existen funcionan en modo Champions sin tocarlas, y `lib/api.ts`
solo tiene que añadir un parámetro más, exactamente como hace con `?session=`.

Los endpoints `/api/champions/:id/pokemon` del encargo original siguen teniendo
sentido, pero para **el editor de reglas** (saber qué hay marcado), no para la
consulta.

Consecuencia si se elige el middleware: cada combinación de reglas genera URLs
distintas, así que el Service Worker las cachea por separado y el modo offline
sigue funcionando conjunto a conjunto. Igual que con las sesiones.

## 2. ¿Champions y sesión de ROM Hack pueden estar activos a la vez?

Hoy `lib/api.ts` añade `?session=` solo. Si Champions añade `?champions=`, hay
que decidir qué pasa cuando están los dos, porque `sessionOverrides` se monta
antes que cualquier otra cosa en `/api`.

**Recomendación: son excluyentes.** Champions es un juego distinto, no un ROM
Hack del mismo juego; mezclar los tipos editados de Radical Red con las reglas
de Champions no significa nada. Entrar en el modo debe desactivar la sesión
activa (que ahora se recuerda por perfil en `settings.active_session`, 5.4, así
que al salir se puede restaurar sola).

El criterio de aceptación de la 6.3 —«se ve siempre y sin ambigüedad en qué modo
estás»— cubre esto: el distintivo de la TopBar tiene que dejar claro que la
sesión está en pausa.

## 3. Los multiplicadores personalizados cambian los VALORES, nunca las CLAVES

`custom_multipliers_json` es tentador, pero las claves `hiper_eficaz`,
`super_eficaz`, `normal`, `poco_eficaz`, `muy_poco_eficaz` y `sin_efecto` son
**valores canónicos del proyecto**: `frontend/src/lib/damage.ts`, `types.ts` y
`EffectivenessPanel.tsx` comparan contra ellas. Un conjunto de reglas puede
decir que «hiper eficaz» vale x3, no puede inventarse una categoría nueva ni
renombrarlas.

Dos avisos concretos para quien haga la 6.2:

- `backend/lib/effectiveness.js` agrupa **por valor numérico** y deduce la clave
  de ahí (`LABELS[4] -> hiper_eficaz`), además de normalizar al más cercano de
  `[4, 2, 1, 0.5, 0.25, 0]`. Con valores configurables hay que darle la vuelta:
  el recorrido pasa a ser clave → valor. Si no, poner «hiper eficaz» a x3 hace
  que el resultado caiga en el cubo de x2.
- Ese módulo abre **su propia conexión a SQLite al importarse**
  (`new Database(DB_PATH, { readonly: true })`) en vez de recibir `db`, que es
  la convención del resto del backend. La 6.2 es el momento natural de
  convertirlo en una factoría `(db, multiplicadores) => ...`.
- En el frontend, `EffectivenessPanel.tsx` indexa `LABEL_KEY` y `ACCENT` por
  multiplicador numérico. Con valores configurables hay que indexar por
  `bucket.key`, que ya viene en la respuesta y no cambia nunca.

## 4. Dónde se guarda el conjunto de reglas activo

`champions_rules` **no tiene `profile_id`**: los conjuntos de reglas son del
hogar, compartidos, como el dataset. Lo que es de cada perfil es **cuál tiene
puesto**, y para eso ya existe el sitio: la tabla `settings` de la 5.4.

Al añadir la clave hay que declararla en `ALLOWED_KEYS` de
`backend/routes/settings.js` (la lista blanca es a propósito) y en
`ProfileSettings` de `frontend/src/lib/apiSession.ts`. Sugerencia de nombre:
`champions_rules`.

## 5. No había datos de objetos ✅ RESUELTO en la tarea 6.0

> **Decidido:** se hizo la tarea **6.0** (`06-00-dataset-objetos.md`) antes de la
> 6.1. Hoy hay **2151 objetos en 54 categorías** en `backend/data/items.json`,
> sembrados y servidos en `GET /api/items`. Lo que sigue queda como registro de
> por qué hizo falta.
>
> Dos cosas que la 6.1 debe dar por sabidas:
> - **No existe un campo «equipable»**, porque PokeAPI no lo sabe (el Chaleco
>   Asalto llega sin atributos y la Poción sí trae `holdable`). Para acotar los
>   objetos de combate hay que usar `category`.
> - Los objetos **no pasan por el middleware de overrides** ni por la
>   exportación e importación de la Fase 4. Sigue pendiente.

El punto original, tal como estaba:

| tabla | filas |
|-------|-------|
| `types` | 18 |
| `pokemon` | 1025 |
| `moves` | 901 |
| `abilities` | 312 |
| **`items`** | **0** |

No hay `backend/data/items.json`, y `tools/fetch-dataset.js` **no descarga
objetos** de PokeAPI. `allowed_items_json` existe en el esquema, pero no hay nada
que marcar ni nada que filtrar.

Opciones, por orden de coste:

1. **Dejar los objetos fuera de la 6.1** y anotarlo. El conjunto de reglas guarda
   `allowed_items_json` sin usar, y la pantalla de reglas no enseña esa pestaña.
2. Añadir los objetos al dataset (ampliar `tools/fetch-dataset.js`, generar
   `data/items.json`, sembrarlos en `db/seed.js` y exponer `/api/items`). Es una
   tarea entera por sí misma: sería una **6.0**, antes de la 6.1.

**Se eligió la 2.** Una trampa que apareció al hacerla y que conviene recordar
para cualquier entidad nueva del dataset: **`pnpm run seed` borra la base
entera**, así que una instalación en marcha no puede incorporar datos nuevos
resembrando (perdería perfiles, sesiones, favoritos, historial y ajustes). Los
objetos entran por `db/migrate.js`, que los siembra solo si la tabla está vacía.

## 6. Recordatorios que ya son convención

- Los endpoints nuevos que el usuario pueda modificar (`/api/champions`) van en
  la **primera regla `runtimeCaching`** de `vite.config.ts` (NetworkFirst), con
  perfiles, favoritos, sesiones, historial y ajustes. Si se quedan en
  StaleWhileRevalidate, editar un conjunto de reglas se verá con una navegación
  de retraso.
- Tablas nuevas y columnas nuevas, en `db/migrate.js`, **idempotente y solo
  aditivo**. `champions_rules` ya existe en `schema.sql`, pero una instalación en
  marcha puede necesitar índices o columnas que ahora no están.
- Cada ruta es un módulo `(db) => router` montado en `server.js`.
- i18n: claves **planas** en `es.json` **y** `en.json`, mismo juego exacto.
