# Tarea 9.4 — Import/export formato Pokémon Showdown

> Pega antes `docs/tasks/_CONTEXTO_BASE.md`.

## Objetivo
Intercambiar equipos con Pokémon Showdown, que es el formato estándar de facto en la comunidad competitiva.

## Contexto extra
Depende de la Fase 2 (modelo de equipo en `frontend/src/lib/team.ts`) y conviene tener 9.1.a (EVs/IVs/naturaleza) para no perder información al convertir.
Formato de ejemplo:

```
Garchomp @ Rocky Helmet
Ability: Rough Skin
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Stealth Rock
- Swords Dance
```

Ojo con los nombres: el formato Showdown está en inglés y PamuDeX trabaja en español e inglés. Necesitas mapear en ambos sentidos usando `name_en` / `name_es`, y avisar de lo que no se pueda resolver en vez de fallar en silencio.

## Entregable
1. `frontend/src/lib/showdown.ts` — `parseShowdown(text): TeamSlot[]` y `toShowdown(team): string`.
2. Manejo de errores: entradas no reconocidas se listan como avisos, importando el resto de lo que sí se entiende.
3. UI en `/equipo`: pegar texto para importar y copiar al portapapeles para exportar.
4. Casos de prueba documentados en comentarios, con al menos un equipo completo de 6.

## Criterios de aceptación
- [ ] Un equipo exportado y vuelto a importar da el mismo resultado (ida y vuelta sin pérdidas).
- [ ] Un Pokémon inexistente en la base de datos genera un aviso, no un fallo total.
- [ ] Funciona con nombres en inglés aunque la app esté en español.

## Fuera de alcance
Conexión en vivo con los servidores de Showdown (requiere su API y sus permisos).
