/**
 * La pista y el pulgar de un interruptor. Solo lo visual: el `role="switch"`,
 * `aria-checked` y la etiqueta los pone el botón que lo contiene, que es quien
 * sabe qué controla. Estaba copiado cuatro veces (ajustes y Champions).
 *
 * El pulgar se desplaza con el muelle sin rebote: un interruptor no es un
 * gesto con inercia, así que no debe pasarse de su sitio. Al ser una
 * transición, si se pulsa otra vez a mitad del recorrido vuelve desde donde
 * está, sin saltar.
 */
export function SwitchTrack({ on, onColor = "bg-success" }: { on: boolean; onColor?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors duration-200 ${
        on ? onColor : "bg-hover"
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full bg-ink shadow-sm transition-transform duration-[var(--dur-spring)]
                    ease-[var(--ease-spring)] ${on ? "translate-x-4" : ""}`}
      />
    </span>
  );
}
