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

# Los 1025 sprites NO están en el repo (ver .gitignore): se bajan aquí, en el
# build, y quedan dentro de la imagen. Así el contenedor no necesita red en
# ningún momento del arranque y la app sigue siendo offline-first de verdad.
#
# Va ANTES de copiar el código del frontend para que la capa quede cacheada:
# si estuviera después, cada cambio de una línea de React volvería a bajar los
# 1025 archivos. El COPY siguiente no los pisa porque .dockerignore excluye
# public/sprites, así que da igual si el que construye los tiene en local.
#
# La ruta importa: el script resuelve el destino como ../../frontend/public/
# sprites desde su propia carpeta, así que tiene que caer en /app/backend/tools.
COPY backend/tools/fetch-sprites.js /app/backend/tools/fetch-sprites.js
RUN node /app/backend/tools/fetch-sprites.js

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
