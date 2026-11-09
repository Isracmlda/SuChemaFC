import { useId, useState } from 'react'
import { MdExpandMore } from 'react-icons/md'
import { cardClass } from '../utils/ui.js'
import Collapsible from './Collapsible.jsx'

/**
 * Recuadro con título que se oculta o se muestra con animación. `actions` (opcional) queda en la
 * esquina superior derecha, en la misma línea del título, y solo se ve mientras el recuadro está abierto.
 */
export default function CollapsibleCard({
  title,
  actions,
  defaultOpen = true,
  className = '',
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <section className={`${cardClass} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            title={open ? 'Ocultar' : 'Mostrar'}
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-11 w-full items-center gap-2 text-start font-semibold"
          >
            <MdExpandMore
              className={`size-6 shrink-0 transition-transform duration-300 motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
              aria-hidden="true"
            />
            {title}
          </button>
        </h3>
        {open && actions && <div className="shrink-0">{actions}</div>}
      </div>
      <Collapsible open={open} id={panelId}>
        <div className="flex flex-col gap-3 pt-3">{children}</div>
      </Collapsible>
    </section>
  )
}
