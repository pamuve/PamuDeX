# --- Etapa 1: build del frontend (Vite) ---
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend

# corepack instala la versión de pnpm fijada en el campo "packageManager" de
# package.json, así que la imagen usa exactamente la misma que en local.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# El lockfile se copia antes que el código para que esta capa quede cacheada:
# solo se reinstala si cambian las dependencias.
# pnpm-workspace.yaml es obligatorio, lleva el allowBuilds de esbuild; sin él
# pnpm bloquea su script de instalación y Vite no puede compilar.
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm run build

# --- Etapa 2: backend + frontend compilado ---
FROM node:22-alpine
WORKDIR /app

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Igual que arriba: pnpm-workspace.yaml lleva el allowBuilds de better-sqlite3.
# Sin él pnpm no ejecuta su script de instalación y el módulo nativo queda inservible.
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./backend/
RUN cd backend && pnpm install --frozen-lockfile --prod

COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

WORKDIR /app/backend
ENV PORT=4000

# La base de datos vive en /data, un directorio que contiene DATOS Y NADA MÁS.
# Es donde docker-compose.yml monta el volumen.
#
# NO montes el volumen en /app/backend/db: ahí está el código (schema.sql,
# seed.js, populate.js, migrate.js). Docker solo copia el contenido de la imagen
# a un volumen vacío, así que el volumen se quedaría con una copia congelada de
# ese código y las actualizaciones de la imagen no llegarían nunca. Ver db/paths.js.
ENV PAMUDEX_DB_DIR=/data
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 4000

# La siembra se ejecuta automáticamente en el primer arranque si /data/pamudex.sqlite
# no existe, y las migraciones de esquema en cada arranque (ver server.js).
CMD ["node", "server.js"]
