const ALIGN = {
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
}

/**
 * Tooltip accesible para controles de solo ícono dentro del navbar (negro).
 * Aparece con hover y con foco de teclado. El control hijo debe llevar su propio
 * `aria-label`, por eso el texto del tooltip se oculta a lectores de pantalla.
 * `align="end"` evita que se desborde cuando el control está en el borde derecho.
 */
export default function Tooltip({ label, align = 'center', bubbleClass = '', children }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-full z-50 mt-2 whitespace-nowrap rounded-md bg-brand-gold px-2 py-1 text-xs font-semibold text-brand-black opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 ${ALIGN[align]} ${bubbleClass}`}
      >
        {label}
      </span>
    </span>
  )
}
