import { useId, useState, useSyncExternalStore } from 'react'
import { MdTune } from 'react-icons/md'
import { cardClass } from '../utils/ui.js'

const MOBILE_QUERY = '(max-width: 639.98px)'

function subscribe(callback) {
  const media = window.matchMedia(MOBILE_QUERY)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  )
}

/**
 * Tarjeta de filtros. En escritorio (sm+) se ve completa, en una cuadrícula (`gridClass`).
 * En móvil queda compacta: `search` siempre visible y el resto (`children`) detrás de un botón
 * de filtros que se despliega con animación. `active` marca con un punto que hay filtros puestos
 * y, junto con `onClear`, muestra "Limpiar filtros" a la izquierda del botón.
 */
export default function FilterPanel({
  search,
  children,
  active = false,
  onClear,
  gridClass = 'sm:grid-cols-3',
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const panelId = useId()

  return (
    <div
      className={`${cardClass} flex flex-col gap-2 p-3 sm:grid sm:gap-3 sm:p-4 ${gridClass} ${className}`}
    >
      <div className="flex items-center justify-between sm:hidden">
        <span className="text-sm font-semibold">{search ? 'Buscar' : 'Filtros'}</span>
        <div className="flex items-center gap-2">
          {active && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex min-h-9 items-center rounded-md border border-border-strong px-3 text-xs font-bold text-fg hover:border-accent hover:text-accent"
            >
              Limpiar filtros
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? 'Ocultar filtros' : 'Mostrar filtros'}
            className="relative inline-flex size-9 items-center justify-center rounded-md border border-border-strong text-fg hover:border-accent hover:text-accent aria-expanded:border-accent aria-expanded:text-accent"
          >
            <MdTune className="size-5" aria-hidden="true" />
            {active && (
              <span
                className="absolute right-1 top-1 size-2 rounded-full bg-accent-solid"
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </div>

      {/* En móvil el buscador queda siempre a la vista; su etiqueta ya la da el encabezado. */}
      {search && (
        <div className="max-sm:[&_label>span:first-child]:sr-only sm:contents">{search}</div>
      )}

      {/* En escritorio los wrappers desaparecen (contents) y los campos entran en la cuadrícula. */}
      <div
        id={panelId}
        inert={isMobile && !open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none sm:contents ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 sm:opacity-100'
        }`}
      >
        <div className="-m-1 flex min-h-0 flex-col gap-2 overflow-hidden p-1 sm:contents">
          {children}
        </div>
      </div>
    </div>
  )
}
