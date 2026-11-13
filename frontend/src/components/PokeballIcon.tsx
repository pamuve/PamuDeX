/**
 * Una Poké Ball en trazo, con la misma firma que los iconos de lucide-react
 * (que no trae ninguna). `filled` rellena la mitad superior: es la diferencia
 * entre «capturado» y «sin capturar» sin depender solo del color.
 */
export function PokeballIcon({
  size = 18,
  filled = false,
  className,
}: {
  size?: number;
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {filled && <path d="M3 12a9 9 0 0 1 18 0h-6a3 3 0 0 0-6 0z" fill="currentColor" stroke="none" />}
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h6m6 0h6" />
      <circle cx="12" cy="12" r="3" fill={filled ? "var(--color-panel)" : "none"} />
    </svg>
  );
}
