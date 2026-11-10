import { useCallback, useEffect, useRef, useState } from 'react'
import { MdChevronLeft, MdChevronRight } from 'react-icons/md'
import { carouselClass } from '../utils/ui.js'

const EDGE = 2 // tolerancia en px al llegar al borde

function ArrowButton({ side, onClick, visible }) {
  const Icon = side === 'left' ? MdChevronLeft : MdChevronRight
  return (
    <>
      {/* Degradado: avisa de que hay más contenido de ese lado */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 z-10 w-14 transition-opacity duration-200 motion-reduce:transition-none ${
          side === 'left' ? 'left-0 bg-linear-to-r' : 'right-0 bg-linear-to-l'
        } from-bg via-bg/70 to-transparent ${visible ? 'opacity-100' : 'opacity-0'}`}
      />
      <button
        type="button"
        // Los chips ya se alcanzan con el teclado: la flecha es una ayuda para mouse y táctil.
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClick}
        className={`absolute top-1/2 z-20 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-surface text-fg shadow-md transition-opacity duration-200 hover:border-accent hover:text-accent motion-reduce:transition-none ${
          side === 'left' ? 'left-0' : 'right-0'
        } ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <Icon className="size-5" aria-hidden="true" />
      </button>
    </>
  )
}

/**
 * Fila desplazable horizontalmente (carrusel). Donde queda contenido oculto aparece un degradado
 * con una flecha en ese borde; al tocar la flecha se desplaza casi un ancho de la fila.
 * `as` es la etiqueta de la lista (`ul` u `ol`); el resto de props van a esa lista.
 */
export default function Carousel({ as: Tag = 'ul', className = '', children, ...rest }) {
  const ref = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const left = el.scrollLeft > EDGE
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [])

  // Cambia el ancho de la fila o su contenido (se agregan o quitan elementos).
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    update()
    const resize = new ResizeObserver(update)
    resize.observe(el)
    const mutation = new MutationObserver(update)
    mutation.observe(el, { childList: true, subtree: true, characterData: true })
    return () => {
      resize.disconnect()
      mutation.disconnect()
    }
  }, [update])

  function scrollByPage(direction) {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div className="relative min-w-0">
      <Tag ref={ref} onScroll={update} className={`${carouselClass} ${className}`} {...rest}>
        {children}
      </Tag>
      <ArrowButton side="left" visible={edges.left} onClick={() => scrollByPage(-1)} />
      <ArrowButton side="right" visible={edges.right} onClick={() => scrollByPage(1)} />
    </div>
  )
}
