# Despliegue y actualizaciones

Cómo se actualiza PamuDeX en el homelab sin perder perfiles, sesiones,
favoritos, historial ni ajustes.

## El circuito

```
   git push a main
        │
        ▼
   GitHub Actions ──► Verificación (tipos, build, pruebas, paridad i18n)
        │                    │
        │                    └── si falla, NO se publica nada
        ▼
   ghcr.io/pamuve/pamudex:latest
        │
        ▼
   Portainer (consulta el repo cada X minutos) ──► redespliega el stack
        │
        ▼
   El contenedor arranca:
     1. copia la base de datos en /data/backups
     2. aplica las migraciones de esquema pendientes
     3. si alguna falla, restaura la copia y NO arranca
     4. sirve la app con tus datos intactos
```

Lo único que hay que hacer para actualizar es `git push`. El resto va solo.

## Qué se conserva y qué se sustituye

| | Dónde vive | Al actualizar |
|---|---|---|
| Código, dataset y sprites | dentro de la imagen | **se sustituyen** |
| Perfiles, sesiones, favoritos, historial, ajustes | volumen `/data` | **se conservan** |
| Copias de seguridad | volumen `/data/backups` | **se conservan** |

La regla que lo hace posible: el volumen se monta en `/data`, un directorio que
contiene **datos y nada más**. Nunca en `/app/backend/db`, que es código —
Docker solo copia contenido a un volumen vacío, así que un volumen ahí congela
el código del esquema en la versión del primer despliegue y las actualizaciones
dejan de llegar.

## Preparación (una sola vez)

### 1. Hacer público el paquete de GHCR

El primer `git push` a `main` construye la imagen, pero **nace privada aunque el
repositorio sea público**. Sin esto Portainer no puede descargarla:

1. GitHub → tu perfil → **Packages** → `pamudex`
2. **Package settings** → *Danger Zone* → **Change visibility** → *Public*

Si prefieres dejarla privada, en Portainer hay que añadir el registro en
**Registries** con tu usuario y un *personal access token* con permiso
`read:packages`.

### 2. Crear el stack en Portainer

**Stacks → Add stack → Repository**

| Campo | Valor |
|---|---|
| Name | `pamudex` |
| Repository URL | `https://github.com/pamuve/PamuDeX` |
| Reference | `refs/heads/main` |
| Compose path | `deploy/portainer-stack.yml` |
| Automatic updates | activado, **Polling**, cada 30 minutos |

**Deploy the stack.** El primer arranque tarda un poco: con el volumen vacío
siembra 1025 Pokémon y 2151 objetos antes de escuchar en el puerto. El
healthcheck lo tiene en cuenta (`start_period` de 60 s).

La app queda en `http://<tu-servidor>:4000`.

> El volumen real se llama `pamudex_pamudex_db`: Portainer le pone delante el
> nombre del stack. Es el nombre que hay que usar en los comandos de este
> documento.

## Actualizar

```bash
git push origin main
```

Y ya está. En la siguiente ronda de *polling* Portainer ve el commit nuevo,
vuelve a descargar la imagen (`pull_policy: always`) y recrea el contenedor.

Para comprobar qué hay desplegado, desde el navegador:

```
http://<tu-servidor>:4000/api/version
```

Devuelve la versión, el commit del que salió la imagen, las migraciones que
tiene registradas la base, la última copia de seguridad y cuántos perfiles,
sesiones y favoritos hay. Ese último bloque es la comprobación de que la
actualización no se ha llevado nada por delante.

### La pega del *polling* (y cómo se arregla)

Portainer redespliega cuando cambia **el commit**, no cuando cambia la imagen.
Si la ronda de comprobación cae justo entre tu `git push` y el final del build
(unos 4-5 minutos), Portainer redesplegará con la imagen **anterior** y no
volverá a intentarlo hasta el siguiente commit.

Se nota mirando `/api/version`: el `commit` no coincide con el último de GitHub.
Se arregla en diez segundos desde Portainer con **Pull and redeploy**, o esperando
al siguiente push. Si te molesta, hay dos alternativas:

- Subir a `main` en tandas, no commit a commit.
- Cambiar el mecanismo a **Webhook**: el workflow avisa a Portainer cuando la
  imagen ya está publicada, así que no hay carrera posible. Exige que Portainer
  sea alcanzable desde internet y guardar la URL del webhook como secreto del
  repositorio.

## Copias de seguridad

Van en `/data/backups`, **dentro del volumen**: tienen que sobrevivir al
contenedor, que es justo lo que se sustituye al actualizar.

- Se crea una **automáticamente antes de cada migración de esquema**, y solo
  entonces: un arranque que no cambia nada no genera copias.
- Se conservan las **5 últimas** (`PAMUDEX_BACKUP_KEEP` en el stack; `0` las
  guarda todas).
- Cada una ocupa lo que la base, menos de 1 MB.

### Crear una a mano

Antes de importar un dataset global, de tocar la tabla de tipos o de cualquier
cosa que dé respeto. **No hace falta parar el contenedor**: se usa
`VACUUM INTO`, que produce un archivo consistente aunque haya escrituras.

```bash
docker exec pamudex node tools/backup.js
```

Listarlas:

```bash
docker exec pamudex node tools/backup.js --list
```

### Sacarlas del servidor

Una copia dentro del mismo servidor no protege del servidor. Para bajarla:

```bash
docker cp pamudex:/data/backups ./copias-pamudex
```

### Restaurar

Hay que **parar el contenedor**: mientras corre tiene la base abierta. Como el
código vive en la imagen, se restaura con un contenedor de usar y tirar sobre el
mismo volumen:

```bash
docker stop pamudex
docker run --rm -v pamudex_pamudex_db:/data -e PAMUDEX_DB_DIR=/data \
  ghcr.io/pamuve/pamudex:latest node tools/restore.js
```

Ese comando **lista** las copias disponibles. Para restaurar una:

```bash
docker run --rm -v pamudex_pamudex_db:/data -e PAMUDEX_DB_DIR=/data \
  ghcr.io/pamuve/pamudex:latest \
  node tools/restore.js pamudex-20260821-070102-pre-migracion.sqlite --si
docker start pamudex
```

Antes de pisar nada guarda el estado actual como una copia más
(`-antes-de-restaurar`), así que una restauración equivocada también se deshace.

## Volver a una versión anterior

Las migraciones son **solo aditivas** —nunca borran ni renombran columnas—, así
que una base migrada sigue sirviendo con código anterior. Volver atrás es
cambiar el tag en `deploy/portainer-stack.yml`:

```yaml
image: ghcr.io/pamuve/pamudex:v1.2.3     # en vez de :latest
```

Los tags disponibles están en GitHub → Packages → `pamudex`. Hay uno por commit
(`sha-a1b2c3d`), y si publicas un tag de git `v1.2.3` también salen `v1.2.3` y
`v1.2`.

Con `image: ...:latest` fijo, un despliegue concreto se recupera desde Portainer:
**Containers → pamudex → Recreate**, desmarcando *Pull latest image*.

## Si algo va mal

### El contenedor no arranca después de actualizar

Mira los logs (Portainer → Containers → pamudex → Logs). Si ves esto:

```
✗ Migración fallida (nombre): mensaje de SQLite
  Base de datos restaurada desde /data/backups/pamudex-...-pre-migracion.sqlite

  El contenedor no arranca a propósito: tus datos están intactos.
```

…es el sistema haciendo su trabajo. La base quedó **exactamente** como estaba
antes de la actualización (todo o nada: también se deshacen las migraciones que
sí habían pasado en ese mismo arranque). Vuelve al tag anterior y abre una
incidencia con ese log.

Un contenedor que arranca a medias y escribe sobre un esquema incompleto hace
mucho más daño que uno que no arranca, y esto último se ve en Portainer al
instante.

### `/api/version` dice `pendientes: 1` o más

La base viene de una versión **posterior** del código: has vuelto a un tag
anterior. Funciona igual, porque las migraciones son solo aditivas, pero
conviene saberlo.

### El contenedor sale como *unhealthy*

`restart: unless-stopped` **no** reinicia por eso: Docker solo reacciona a que
el proceso muera. El estado está a la vista en Portainer para que lo veas tú.

## Lo que nunca hay que hacer

- **`pnpm run seed` en producción.** Borra la base entera: perfiles, sesiones,
  favoritos, historial y ajustes. Los datos nuevos del dataset entran por
  `db/migrate.js`, condicionados a que la tabla esté vacía.
- **Montar el volumen en `/app/backend/db`.** Congela el código del esquema en
  la versión del primer despliegue y rompe las actualizaciones en silencio.
- **Construir la imagen en el servidor.** Para eso está `docker-compose.yml`, y
  es para desarrollo local; en el homelab la imagen viene hecha.
