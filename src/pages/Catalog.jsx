import { useEffect, useMemo, useState } from 'react'
import { MdAdd, MdChevronRight, MdInventory2, MdSearch } from 'react-icons/md'
import { Link, useSearchParams } from 'react-router-dom'
import Field from '../components/Field.jsx'
import { EmptyState, ErrorState } from '../components/States.jsx'
import { GridSkeleton, ProductGrid } from '../features/catalog/ProductCard.jsx'
import {
  SORT_OPTIONS,
  descendantIds,
  filterProducts,
  sectionPath,
  sortProducts,
} from '../features/catalog/search.js'
import { useAsync } from '../hooks/useAsync.js'
import { useAuth } from '../hooks/useAuth.js'
import { loadCatalog } from '../services/storefront.js'
import { toInt } from '../utils/format.js'
import { btnPrimary, btnSecondary, inputClass } from '../utils/ui.js'

const PAGE_SIZE = 12
const DEFAULT_FILTERS = {
  query: '',
  sectionId: '',
  min: '',
  max: '',
  order: 'recientes',
}

// Los filtros viven mientras la app esté abierta: al volver desde el detalle no se pierden.
let remembered = { ...DEFAULT_FILTERS }

export default function Catalog() {
  const { data, loading, error, reload } = useAsync(loadCatalog)
  const { isAdmin } = useAuth()
  // Un enlace con ?seccion=ID (por ejemplo desde la portada) abre esa sección directamente.
  const [params] = useSearchParams()
  const [filters, setFilters] = useState(() => ({
    ...remembered,
    ...(params.get('seccion') ? { sectionId: params.get('seccion') } : {}),
  }))
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    remembered = filters
  }, [filters])

  const update = (patch) => {
    setFilters((f) => ({ ...f, ...patch }))
    setVisibleCount(PAGE_SIZE)
  }

  const results = useMemo(() => {
    if (!data) return []
    const sectionIds = filters.sectionId ? descendantIds(data.sections, filters.sectionId) : null
    const filtered = filterProducts(
      data.products,
      {
        query: filters.query,
        sectionIds,
        min: toInt(filters.min),
        max: toInt(filters.max),
      },
      data.tags,
    )
    return sortProducts(filtered, filters.order)
  }, [data, filters])

  if (error) return <ErrorState error={error} onRetry={reload} />

  const sections = data?.sections ?? []
  const path = filters.sectionId ? sectionPath(sections, filters.sectionId) : []
  const children = sections.filter((s) => (s.parentId ?? '') === (filters.sectionId || ''))
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)
  const shown = results.slice(0, visibleCount)

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">SuChemaFC</h1>

      {isAdmin && (
        <div
          role="region"
          aria-label="Herramientas de administración"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-accent bg-surface p-3"
        >
          <span className="me-auto text-sm font-semibold">Administración</span>
          <Link to="/admin/productos?nueva=1" className={btnPrimary}>
            <MdAdd className="size-5" aria-hidden="true" />
            Agregar camisa
          </Link>
          <Link to="/admin/productos" className={btnSecondary}>
            <MdInventory2 className="size-5" aria-hidden="true" />
            Administrar camisas
          </Link>
        </div>
      )}

      <nav aria-label="Ruta de secciones">
        <ol className="flex flex-wrap items-center gap-1 text-sm">
          <li>
            <button
              type="button"
              onClick={() => update({ sectionId: '' })}
              aria-current={path.length === 0 ? 'page' : undefined}
              className="min-h-11 rounded px-2 font-semibold hover:text-accent aria-[current=page]:text-fg"
            >
              Inicio
            </button>
          </li>
          {path.map((s, i) => (
            <li key={s.id} className="flex items-center gap-1">
              <MdChevronRight className="size-4 text-muted" aria-hidden="true" />
              <button
                type="button"
                onClick={() => update({ sectionId: s.id })}
                aria-current={i === path.length - 1 ? 'page' : undefined}
                className="min-h-11 rounded px-2 font-semibold hover:text-accent"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {children.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Subsecciones">
          {children.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => update({ sectionId: s.id })}
                className="inline-flex min-h-11 items-center rounded-full border border-border-strong px-4 text-sm font-semibold hover:border-accent hover:text-accent"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Buscar" className="sm:col-span-2">
          <div className="relative">
            <MdSearch
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => update({ query: e.target.value })}
              placeholder="Equipo, liga, jugador o #hashtag"
              className={`${inputClass} pl-10`}
            />
          </div>
        </Field>
        <Field label="Ordenar por">
          <select
            value={filters.order}
            onChange={(e) => update({ order: e.target.value })}
            className={inputClass}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Precio mín. (₡)">
            <input
              type="number"
              min="0"
              step="1000"
              inputMode="numeric"
              value={filters.min}
              onChange={(e) => update({ min: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Precio máx. (₡)">
            <input
              type="number"
              min="0"
              step="1000"
              inputMode="numeric"
              value={filters.max}
              onChange={(e) => update({ max: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setFilters({ ...DEFAULT_FILTERS })
            setVisibleCount(PAGE_SIZE)
          }}
          className={`${btnSecondary} self-start`}
        >
          Limpiar filtros
        </button>
      )}

      {loading ? (
        <GridSkeleton />
      ) : results.length === 0 ? (
        <EmptyState>
          {data.products.length === 0
            ? 'Aún no hay camisas en el catálogo. Vuelve pronto.'
            : 'No encontramos camisas con esos filtros.'}
        </EmptyState>
      ) : (
        <>
          <p role="status" className="text-sm text-muted">
            {results.length} camisa{results.length === 1 ? '' : 's'}
          </p>
          <ProductGrid products={shown} />
          {shown.length < results.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className={`${btnSecondary} self-center`}
            >
              Ver más ({results.length - shown.length})
            </button>
          )}
        </>
      )}
    </div>
  )
}
