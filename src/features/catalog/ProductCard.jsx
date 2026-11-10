import { useEffect, useState } from 'react'
import { MdEdit } from 'react-icons/md'
import { Link, useLocation } from 'react-router-dom'
import DriveImage from '../../components/DriveImage.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { formatCRC } from '../../utils/format.js'
import { isSaleActive } from './salePrice.js'
import { priceSummary } from './variants.js'

/**
 * Tarjeta de camisa para listados. Con versiones de precios vigentes distintos muestra "desde ₡X"
 * (el menor); la portada es siempre la imagen de la camisa base.
 */
export default function ProductCard({ product, layout = 'cards' }) {
  const { showAdminUi } = useAuth()
  const location = useLocation()
  const { min, from, onSale } = priceSummary(product)
  const showStrike = !from && isSaleActive(product)
  const isList = layout === 'list'
  // Al guardar o cancelar la edición se regresa a la pantalla desde la que se entró.
  const back = encodeURIComponent(`${location.pathname}${location.search}`)
  return (
    <div className="group/card relative flex w-full">
      <Link
        to={`/producto/${product.id}`}
        className={`press group flex w-full overflow-hidden rounded-lg border border-border bg-surface hover:border-accent ${isList ? 'flex-row' : 'flex-col'}`}
      >
        <div className={`relative ${isList ? 'w-24 shrink-0 sm:w-32' : ''}`}>
          <DriveImage id={product.images?.[0]} size={500} alt="" className="aspect-square" />
          {onSale && (
            <span className="absolute left-2 top-2 rounded-md bg-accent-solid px-2 py-0.5 text-xs font-bold text-on-accent">
              Oferta
            </span>
          )}
        </div>
        <div
          className={`flex flex-1 flex-col gap-1 p-2 sm:p-3 ${isList ? 'justify-center pe-12' : ''}`}
        >
          <h3 className="line-clamp-2 text-sm font-semibold">{product.name}</h3>
          <p className="mt-auto flex flex-wrap items-baseline gap-2">
            {from && <span className="text-xs text-muted">desde</span>}
            <span className="font-bold">{formatCRC(min)}</span>
            {showStrike && (
              <s className="text-xs text-muted">
                <span className="sr-only">Antes </span>
                {formatCRC(product.price)}
              </s>
            )}
          </p>
        </div>
      </Link>
      {showAdminUi && (
        <Link
          to={`/admin/productos?editar=${encodeURIComponent(product.id)}&volver=${back}`}
          aria-label={`Editar ${product.name}`}
          title="Editar camisa"
          className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full border border-border-strong bg-surface text-fg shadow-lg hover:border-accent hover:text-accent focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/card:opacity-100"
        >
          <MdEdit className="size-5" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

const LEAVE_MS = 200

/**
 * Cuadrícula de tarjetas, de 2 columnas en móvil a 4 en escritorio. Las tarjetas que aparecen al
 * filtrar entran con un fundido y las que salen se mantienen un instante para animar su salida.
 */
export function ProductGrid({ products, layout = 'cards' }) {
  const [entries, setEntries] = useState(() => products.map((p) => ({ p, leaving: false })))
  const [prevProducts, setPrevProducts] = useState(products)

  // Al cambiar la lista se recalculan las entradas durante el render (sin un render intermedio).
  if (products !== prevProducts) {
    setPrevProducts(products)
    const ids = new Set(products.map((p) => p.id))
    const next = products.map((p) => ({ p, leaving: false }))
    entries.forEach((entry, index) => {
      if (!ids.has(entry.p.id))
        next.splice(Math.min(index, next.length), 0, { ...entry, leaving: true })
    })
    setEntries(next)
  }

  useEffect(() => {
    if (!entries.some((e) => e.leaving)) return undefined
    const timer = setTimeout(() => setEntries((list) => list.filter((e) => !e.leaving)), LEAVE_MS)
    return () => clearTimeout(timer)
  }, [entries])

  return (
    <ul
      className={
        layout === 'list'
          ? 'flex flex-col gap-2'
          : 'grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4'
      }
    >
      {entries.map(({ p, leaving }) => (
        <li
          key={p.id}
          inert={leaving}
          style={{ viewTransitionName: `camisa-${p.id.replace(/[^a-zA-Z0-9_-]/g, '')}` }}
          className={`flex ${leaving ? 'card-leave' : 'card-enter'}`}
        >
          <div className="flex w-full">
            <ProductCard product={p} layout={layout} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Esqueletos de carga con la forma de la cuadrícula. */
export function GridSkeleton({ count = 8 }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="animate-pulse overflow-hidden rounded-lg border border-border bg-surface"
        >
          <div className="aspect-square bg-surface-2" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 rounded bg-surface-2" />
            <div className="h-3 w-1/3 rounded bg-surface-2" />
          </div>
        </li>
      ))}
    </ul>
  )
}
