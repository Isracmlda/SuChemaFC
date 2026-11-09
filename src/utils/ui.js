/** Clases reutilizables de Tailwind para formularios y botones (usan los tokens de tema). */
const BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50'

export const btnPrimary = `${BTN} bg-accent-solid text-on-accent hover:bg-accent-solid-hover`
export const btnSecondary = `${BTN} border border-border-strong text-fg hover:border-accent hover:text-accent`
export const btnDanger = `${BTN} border border-danger text-danger hover:bg-danger hover:text-bg`
export const btnIcon =
  'inline-flex size-10 items-center justify-center rounded-md border border-border-strong text-fg hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40'

export const inputClass =
  'min-h-11 w-full rounded-md border border-border-strong bg-bg px-3 text-fg placeholder:text-muted'

export const cardClass = 'rounded-lg border border-border bg-surface p-4'

/** Fila horizontal desplazable (carrusel) sin barra visible. */
export const carouselClass =
  'flex flex-nowrap items-center gap-2 overflow-x-auto snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

/**
 * Fila de botones de acción. En móvil quedan en una sola línea, repartiéndose el ancho, con menos
 * relleno y texto más pequeño (para etiquetas cortas). En escritorio se ven normales y pueden partirse.
 */
export const actionRowClass =
  'flex gap-2 sm:flex-wrap max-sm:[&>*]:min-w-0 max-sm:[&>*]:flex-1 max-sm:[&>*]:gap-1! max-sm:[&>*]:px-2! max-sm:[&>*]:text-center max-sm:[&>*]:text-xs!'

/** Como actionRowClass pero apilados a ancho completo en móvil, para etiquetas largas. */
export const actionStackClass = 'flex flex-col gap-2 sm:flex-row sm:flex-wrap max-sm:[&>*]:w-full'

/** Botón de ícono del navbar (negro): sin borde, para que la fila de acciones no se vea recargada. */
export const navIconClass =
  'inline-flex size-10 items-center justify-center rounded-full text-brand-gold hover:bg-brand-gold/15'

/** Igual que navIconClass pero en estado activo/seleccionado: dorado sólido. */
export const navIconActiveClass =
  'inline-flex size-10 items-center justify-center rounded-full bg-brand-gold text-brand-black'
