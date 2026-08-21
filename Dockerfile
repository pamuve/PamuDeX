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

# --- Identidad de la imagen ---
#
# Va AQUÍ ABAJO, después de todos los COPY y RUN, porque cada commit cambia
# estos valores: más arriba invalidaría la caché de las capas de instalación y
# cada build se volvería a bajar los sprites y a reinstalar dependencias.
#
# Los rellena el workflow de GitHub Actions con el tag y el SHA del commit. Sin
# ellos (build a mano en local) la app se identifica con la versión de
# package.json y sin commit, que es la verdad: no hay despliegue del que hablar.
ARG VERSION=dev
ARG COMMIT=
ARG BUILD_DATE=
ENV PAMUDEX_VERSION=$VERSION
ENV PAMUDEX_COMMIT=$COMMIT
ENV PAMUDEX_BUILD_DATE=$BUILD_DATE

# Etiquetas OCI estándar: son las que enseña Portainer en la ficha de la imagen
# y las que hacen que GitHub enlace el paquete con el repositorio.
LABEL org.opencontainers.image.title="PamuDeX"
LABEL org.opencontainers.image.description="Pokédex PWA offline-first para ROM Hacks de Pokémon"
LABEL org.opencontainers.image.source="https://github.com/pamuve/PamuDeX"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.version=$VERSION
LABEL org.opencontainers.image.revision=$COMMIT
LABEL org.opencontainers.image.created=$BUILD_DATE

# El healthcheck se declara AQUÍ, no solo en docker-compose.yml: así lo hereda
# cualquier forma de arrancar la imagen (incluido un `docker run` a pelo o un
# contenedor creado a mano desde Portainer), y el estado sale en `docker ps`.
# `wget` viene en el busybox de alpine, no hace falta instalar curl.
#
# start_period cubre la siembra inicial: el primer arranque con el volumen vacío
# crea 1025 Pokémon y 2151 objetos antes de escuchar en el puerto.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget --quiet --spider http://localhost:4000/api/health || exit 1

# La siembra se ejecuta automáticamente en el primer arranque si /data/pamudex.sqlite
# no existe, y las migraciones de esquema en cada arranque (ver server.js).
#
# CMD en forma exec (sin shell) A PROPÓSITO: así node es el PID 1 y recibe el
# SIGTERM de `docker stop` tal cual. Con la forma shell, el SIGTERM se lo queda
# /bin/sh, node nunca se entera y SQLite se cierra a la brava en cada
# actualización. El manejador está en server.js.
CMD ["node", "server.js"]
