# App Android

PamuDeX para Android reutiliza el frontend actual y lo empaqueta con Tauri 2.
La ventana es una app Android; Rust inicia el contenedor nativo y la interfaz
React sigue encargándose de las pantallas. Reescribir la Pokédex en Rust no
aceleraría el trabajo que más pesa aquí (peticiones y render del catálogo) y
duplicaría toda la interfaz.

## Preparación del entorno

Instala Node 22, pnpm, Rust, Android Studio y los componentes Android SDK, NDK,
Build Tools y Command-line Tools. Añade los targets Android de Rust requeridos
por Tauri. La guía oficial de [prerrequisitos de Tauri](https://tauri.app/start/prerequisites/)
incluye los pasos para Windows y Android.

Desde `frontend`, genera el proyecto Android una sola vez:

```powershell
pnpm android:init
```

## Conectar con el servidor

La URL del servidor se compila dentro de la app. Usa la dirección HTTPS pública
o de tu red local, sin `/api` al final:

```powershell
$env:VITE_API_BASE_URL = "https://dex.ejemplo.net"
pnpm android:build
```

En Portainer configura `PAMUDEX_CORS_ORIGIN` con el origen de Tauri Android:
`http://tauri.localhost`. La API acepta ese origen solo cuando el administrador
lo permite explícitamente. Si ya tienes una lista, separa los orígenes con
comas. Publica el servidor por HTTPS cuando la app vaya a conectarse desde fuera
de la red local.

Con un dispositivo conectado, `pnpm android:dev` ejecuta la app para desarrollo.
`pnpm android:build` genera el APK de release para instalarlo manualmente. El
proyecto Android nativo que crea `android:init` queda en `src-tauri/gen/android`.

## Sincronizar y usar sin conexión

La sincronización de catálogo ya está implementada en **Ajustes → Datos sin
conexión → Descargar**. Descarga los listados y las fichas de tipos desde el
servidor y los guarda en IndexedDB; la fecha y el progreso aparecen en esa
misma sección. La app Android mantiene ese almacenamiento entre aperturas. Al
estar conectado, perfiles, favoritos, sesiones y reglas de Champions siguen
consultándose en el servidor.

La descarga no es una copia completa de todas las fichas individuales: Pokémon,
movimientos y habilidades se guardan al visitarlos. La app sigue siendo
offline-first y permite sincronizar el catálogo de antemano desde Ajustes.
