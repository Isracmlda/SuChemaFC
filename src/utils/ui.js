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
