# Tarea 5.2 — Contraseña opcional por perfil

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Permitir que un perfil quede protegido con contraseña. Es opcional: un perfil sin contraseña entra directo.

## Contexto extra
Depende de 5.1. La tabla `users` tiene `password_hash` (NULL = sin contraseña).
Alcance realista: esto protege perfiles entre convivientes, **no** es autenticación fuerte para exponer la app a internet. Dilo así en el README para no dar una falsa sensación de seguridad.

## Entregable
1. Hash con `bcrypt` (o `node:crypto` con `scrypt` si prefieres cero dependencias nuevas). **Nunca guardes la contraseña en claro.**
2. `POST /api/profiles/:id/password` (establecer/cambiar), `DELETE /api/profiles/:id/password` (quitar, exige la actual), `POST /api/profiles/:id/verify` (comprobar).
3. UI: al pulsar un perfil con contraseña, modal de introducción; error claro si falla, sin revelar si el perfil existe o no.
4. Indicador de candado en las tarjetas de perfil protegidas.
5. Limitar intentos (por ejemplo, pausa creciente tras 5 fallos) para no facilitar fuerza bruta.

## Criterios de aceptación
- [ ] La contraseña nunca viaja ni se almacena en claro (compruébalo mirando la tabla).
- [ ] Un perfil sin contraseña sigue entrando de un toque.
- [ ] Quitar la contraseña exige conocer la actual.

## Fuera de alcance
Sesiones con token/JWT, usuarios remotos, exposición pública de la app.
