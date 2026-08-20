import { useState } from "react";

interface Props {
  /** Nº de Pokédex. El sprite va por número, NUNCA por nombre: un ROM Hack
   *  puede renombrar al Pokémon con un override y la imagen no debe irse. */
  dex: number;
  /** Solo para la inicial de reserva si el archivo no estuviera. */
  nombre: string;
  /** Tamaño, en clases de Tailwind. En `rem` para que acompañe al escalado de
   *  texto de la 8.1: con un tamaño en píxeles el sprite se quedaría pequeño
   *  dentro de una tarjeta que sí crece. */
  className?: string;
}

/**
 * El sprite de un Pokémon, con la inicial de siempre como reserva.
 *
 * `loading="lazy"` no es opcional aquí: la Pokédex de /pokemon pinta las 1025
 * tarjetas de una vez, y sin él la primera carga dispararía 1025 peticiones de
 * imagen. Con carga diferida el navegador pide solo las que se ven.
 *
 * Los PNG no están en el repo (se bajan con backend/tools/fetch-sprites.js y
 * los sirve el propio backend desde /sprites), así que la reserva no es
 * decorativa: es lo que se ve si alguien levanta el proyecto sin bajarlos.
 */
export function PokemonSprite({ dex, nombre, className = "w-16 h-16" }: Props) {
  // Guarda el Nº que falló, no un booleano: si la lista se filtra y el
  // componente se reutiliza para otro Pokémon, se reintenta solo.
  const [fallido, setFallido] = useState<number | null>(null);

  // `aria-hidden` en ambos casos: el nombre va siempre al lado en texto, y
  // repetirlo solo alarga el recorrido con un lector de pantalla.
  if (fallido === dex) {
    return (
      <span className={`${className} flex items-center justify-center`} aria-hidden="true">
        {nombre[0]}
      </span>
    );
  }

  return (
    <img
      src={`/sprites/${dex}.png`}
      alt=""
      width={96}
      height={96}
      loading="lazy"
      decoding="async"
      onError={() => setFallido(dex)}
      className={`${className} object-contain [image-rendering:pixelated]`}
    />
  );
}
