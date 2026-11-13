#!/bin/sh
# Arranque del contenedor de PamuDeX. Ver el comentario del Dockerfile.
set -e

DATOS="${PAMUDEX_DB_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
  # Solo se cambia el propietario si hace falta: en un volumen ya corregido
  # esto no toca nada, así que el arranque normal no paga un chown recursivo.
  if [ -d "$DATOS" ] && [ -n "$(find "$DATOS" ! -user node -print -quit 2>/dev/null)" ]; then
    echo "Ajustando el propietario de $DATOS al usuario node..."
    chown -R node:node "$DATOS"
  fi
  exec su-exec node "$@"
fi

# Si alguien lanza el contenedor con `--user`, se respeta y no se cambia nada.
exec "$@"
