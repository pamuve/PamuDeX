# Tarea 9.5 — Sprites personalizados y editor avanzado de ROM Hacks

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Subir sprites propios y ampliar el editor de sesiones para ROM Hacks con mecánicas no estándar.

## Contexto extra
Depende de la Fase 3 (sesiones y editor visual). La tabla `pokemon` ya tiene una columna `sprite_path` sin usar.
Hoy las fichas muestran un cuadro con la inicial del nombre en vez de un sprite — este es el punto en el que eso se resuelve.
Aviso importante: subir archivos abre una superficie de ataque. Valida tipo y tamaño real del archivo (no te fíes de la extensión ni del `Content-Type`), guarda con nombres generados por el servidor y sírvelos desde una ruta estática dedicada.

## Entregable
1. `POST /api/sprites` con `multer`: solo PNG/WebP, máximo 1 MB, dimensiones máximas razonables (por ejemplo 512x512), nombre de archivo generado por el servidor.
2. Almacenamiento en `backend/uploads/sprites/`, servido como estático, e incluido en el volumen de Docker (actualiza `docker-compose.yml` para que persista).
3. Selector de sprite en `PokemonForm.tsx` con previsualización y opción de volver al predeterminado.
4. Mostrar el sprite en `PokemonDetail`, en la Pokédex de inicio y en las tarjetas del comparador de equipos.
5. Mecánicas personalizadas por sesión: campo libre de notas y reglas propias por entidad, para lo que no encaje en el modelo estándar.

## Criterios de aceptación
- [ ] Un archivo que no sea imagen se rechaza aunque tenga extensión `.png`.
- [ ] Los sprites sobreviven a `docker compose down && up` (volumen correcto).
- [ ] Sin sprite personalizado, se mantiene el aspecto actual sin errores.

## Fuera de alcance
Extraer sprites automáticamente de una ROM (implicaciones legales y de distribución).
