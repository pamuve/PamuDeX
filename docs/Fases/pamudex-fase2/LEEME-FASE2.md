# PamuDeX — Entrega Fase 2

Contenido de este zip: **solo los archivos nuevos y modificados**. La estructura de carpetas es idéntica a la del repositorio, así que puedes extraer y copiar encima directamente (los archivos existentes se sobrescriben con su versión actualizada).

## Archivos NUEVOS

```
frontend/src/lib/team.ts                       modelo de equipo + 25 naturalezas + localStorage
frontend/src/lib/damage.ts                     motor de estimación de daño
frontend/src/lib/recommendation.ts             analizador "mejor respuesta"
frontend/src/lib/coverage.ts                   análisis de cobertura del equipo
frontend/src/components/TeamSlotCard.tsx       tarjeta de Pokémon propio
frontend/src/components/RivalSlotCard.tsx      tarjeta de Pokémon rival
frontend/src/components/RecommendationCard.tsx tarjeta de recomendación
frontend/src/components/CoverageMap.tsx        mapa de cobertura
frontend/src/pages/TeamBuilder.tsx             página /equipo
docs/tasks/README.md                           índice de encargos
docs/tasks/_CONTEXTO_BASE.md                   contexto compartido para IAs
docs/tasks/fase3..fase9/*.md                   28 encargos del resto de fases
```

## Archivos MODIFICADOS (sobrescribir)

```
frontend/src/types.ts              + tipos de Fase 2 (Team, RivalSlot, DamageEstimate, CoverageReport...)
frontend/src/App.tsx               + ruta /equipo
frontend/src/components/TopBar.tsx + acceso directo al comparador
frontend/src/i18n/index.tsx        + soporte de parámetros t("clave", { name: "X" })
frontend/src/i18n/es.json          + claves team.* recommendation.* coverage.*
frontend/src/i18n/en.json          idem en inglés
docs/ROADMAP.md                    Fase 2 marcada como completada
```

## Después de copiar

```bash
cd frontend
npm run build     # verificado: compila sin errores
```

No hay dependencias nuevas ni cambios en el backend: la Fase 2 es íntegramente frontend y usa la API que ya existía.

## Qué hace

Ruta `/equipo` (icono de espadas en la barra superior):

- **Mi equipo**: hasta 6 Pokémon con objeto, habilidad (solo las reales de ese Pokémon, incluida la oculta), naturaleza y hasta 4 movimientos.
- **Equipo rival**: hasta 6, con movimientos conocidos y sospechados diferenciados.
- **Recomendación**: por cada rival, qué Pokémon propio entra mejor, con motivos (✓) y peligros (✗).
- **Cobertura**: debilidad global, tipos que nadie resiste, tipos repetidos, huecos ofensivos y focos de riesgo defensivo.

Todo se guarda en `localStorage` (`pamudex_team_own` y `pamudex_team_rival`). Pasará a la base de datos cuando existan perfiles de usuario (Fase 5).

## Cómo seguir con las fases 3-9

Abre una conversación nueva con cualquier IA, pega `docs/tasks/_CONTEXTO_BASE.md`, pega el archivo de la tarea que toque, y listo. No necesita más contexto.
