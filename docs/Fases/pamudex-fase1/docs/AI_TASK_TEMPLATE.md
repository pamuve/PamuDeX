# Plantilla de encargo autocontenido para IA

Copia este esqueleto para crear el `.md` de cualquier tarea nueva (Fase 3 en adelante). El objetivo: que **cualquier IA, en una conversación nueva y sin memoria del proyecto**, pueda generar código correcto y coherente solo con este archivo (+ los ficheros fuente concretos que se le adjunten).

---

## 1. Resumen del proyecto (2-3 frases, siempre igual)

PamuDeX es una PWA autoalojada y offline-first para consultar tipos, Pokémon, movimientos y habilidades, con arquitectura preparada para comparador de equipos, sesiones ROM Hack, editor visual, perfiles multiusuario y modo Champions.
Stack: **React + TypeScript + Vite + TailwindCSS** (frontend) · **Node.js + Express + SQLite/better-sqlite3** (backend) · Docker de un solo contenedor.

## 2. Contexto mínimo necesario para ESTA tarea

- Qué partes del proyecto ya existen y son relevantes (pega aquí solo lo que haga falta: interfaces TS, fragmentos de `schema.sql`, rutas Express existentes).
- Qué ficheros fuente reales hay que adjuntar a la conversación (rutas exactas).

## 3. Convenciones que hay que respetar

- Colores OLED (nunca negro puro): base `#0A1425`, panel `#132238`, hover `#1C3350`, texto `#F5F7FA`, texto secundario `#A9BDD2`.
- Tarjetas: `rounded-xl2`, `shadow-card`, animación `animate-fadein` (ya definidas en `tailwind.config.js`).
- i18n: nunca texto suelto en JSX; añadir claves a `frontend/src/i18n/es.json` y `en.json`, usar `useI18n().t("clave")`.
- Nombres de tipos en minúscula sin tilde como IDs (`electrico`, `psiquico`...) — ver `backend/data/types.json`.
- Rutas backend devuelven JSON plano, sin envoltorios `{ data: ... }`.
- Componentes en `frontend/src/components/`, páginas (con ruta propia) en `frontend/src/pages/`.

## 4. Entregable exacto de esta tarea

(Descripción precisa y acotada — una sola responsabilidad.)

## 5. Archivos a crear/modificar

- `ruta/exacta/archivo1.ts` — qué debe contener
- `ruta/exacta/archivo2.tsx` — qué debe contener

## 6. Criterios de aceptación

- [ ] Se puede verificar así: ...
- [ ] No rompe nada de lo existente: ...

## 7. Fuera de alcance (explícitamente)

Cosas que NO debe tocar esta tarea, para no invadir el trabajo de otra tarea del roadmap.
