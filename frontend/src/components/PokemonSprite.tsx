import { useState } from "react";

/**
 * Sprite de un Pokémon. Pide `/sprites/<dex>.png` (o la versión variocolor, o
 * el de una forma) y, si el archivo no existe, cae a la inicial del nombre.
 *
 * POR NÚMERO DE POKÉDEX, NO POR NOMBRE: un ROM Hack puede renombrar al Pokémon
 * y el archivo seguiría siendo el mismo.
 *
 * El estado guarda QUÉ ruta falló, no un booleano: el componente se reutiliza al
 * navegar de una ficha a otra (misma posición en el árbol), y con un booleano el
 * fallo del anterior se heredaría.
 *
 * `shiny` (Fase 9) pide `/sprites/shiny/<dex>.png`; `formId`, el de una forma
 * (mega, regional…) en `/sprites/forms/<id>.png`. Si el variocolor no está, se
 * enseña el normal antes de rendirse a la inicial.
 */
interface Props {
  dex: number;
  nombre: string;
  className?: string;
  shiny?: boolean;
  formId?: number | null;
}

export function PokemonSprite({ dex, nombre, className = "w-16 h-16", shiny = false, formId = null }: Props) {
  const [fallidas, setFallidas] = useState<string[]>([]);

  const candidatas = [
    ...(formId ? [`/sprites/forms/${formId}.png`] : []),
    ...(shiny && !formId ? [`/sprites/shiny/${dex}.png`] : []),
    ...(formId ? [] : [`/sprites/${dex}.png`]),
  ];
  const src = candidatas.find((ruta) => !fallidas.includes(ruta));

  if (!src) {
    return (
      <span className={`${className} flex items-center justify-center`} aria-hidden="true">
        {nombre[0]}
      </span>
    );
  }

  return (
    <img
      key={src}
      src={src}
      alt=""
      width={96}
      height={96}
      loading="lazy"
      decoding="async"
      onError={() => setFallidas((prev) => (prev.includes(src) ? prev : [...prev, src]))}
      className={`${className} object-contain [image-rendering:pixelated]`}
    />
  );
}
