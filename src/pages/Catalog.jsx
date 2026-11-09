import { useEffect, useMemo, useState } from 'react'
import { MdAdd, MdChevronRight, MdClose, MdInventory2, MdSearch, MdTune } from 'react-icons/md'
import { Link, useSearchParams } from 'react-router-dom'
import Collapsible from '../components/Collapsible.jsx'
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
import { btnPrimary, btnSecondary, carouselClass, inputClass } from '../utils/ui.js'

const PAGE_SIZE = 12
const DEFAULT_FILTERS = {
  query: '',
  sectionId: '',
  tagId: '',
  min: '',
  max: '',
  order: 'recientes',
}

// Los filtros viven mientras la app esté abierta: al volver desde el detalle no se pierden.
let remembered = { ...DEFAULT_FILTERS }

export default function Catalog() {
  const { data, loading, error, reload } = useAsync(loadCatalog)
  const { showAdminUi } = useAuth()
  // Un enlace con ?seccion=ID (por ejemplo desde la portada) abre esa sección directamente, y con
  // ?hashtag=ID (desde el detalle de una camisa) muestra solo las camisas con ese hashtag.
  const [params] = useSearchParams()
  const [filters, setFilters] = useState(() => ({
    ...remembered,
    ...(params.get('seccion') ? { sectionId: params.get('seccion') } : {}),
    ...(params.get('hashtag') ? { tagId: params.get('hashtag') } : {}),
  }))
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [filtersOpen, setFiltersOpen] = useState(false)

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
        tagId: filters.tagId,
        min: toInt(filters.min),
        max: toInt(filters.max),
      },
      data.tags,
    )
    return sortProducts(filtered, filters.order)
  }, [data, filters])

  if (error) return <ErrorState error={error} onRetry={reload} />

  const sections = data?.sections ?? []
  const activeTag = filters.tagId ? data?.tags.find((t) => t.id === filters.tagId) : null
  const path = filters.sectionId ? sectionPath(sections, filters.sectionId) : []
  const children = sections.filter((s) => (s.parentId ?? '') === (filters.sectionId || ''))
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)
  const advancedActive =
    filters.order !== DEFAULT_FILTERS.order || filters.min !== '' || filters.max !== ''
  const shown = results.slice(0, visibleCount)

  return (
    <div className="flex flex-col gap-3 sm:gap-5">
      <h1 className="sr-only">SuChemaFC</h1>

      {showAdminUi && (
        <div
          role="region"
          aria-label="Herramientas de administración"
          className="flex items-center gap-2 rounded-lg border border-accent bg-surface p-2 sm:p-3"
        >
          <span className="me-auto hidden text-sm font-semibold sm:inline">Administración</span>
          <Link
            to="/admin/productos?nueva=1"
            className={`${btnPrimary} max-sm:flex-1 max-sm:gap-1 max-sm:px-2! max-sm:text-xs! whitespace-nowrap`}
          >
            <MdAdd className="size-5" aria-hidden="true" />
            Agregar camisa
          </Link>
          <Link
            to="/admin/productos"
            className={`${btnSecondary} max-sm:flex-1 max-sm:gap-1 max-sm:px-2! max-sm:text-xs! whitespace-nowrap`}
          >
            <MdInventory2 className="size-5" aria-hidden="true" />
            Administrar camisas
          </Link>
        </div>
      )}

      <nav aria-label="Ruta de secciones">
        <ol className={`${carouselClass} gap-1 text-sm`}>
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => update({ sectionId: '' })}
              aria-current={path.length === 0 ? 'page' : undefined}
              className="min-h-9 rounded px-2 font-semibold hover:text-accent aria-[current=page]:text-fg sm:min-h-11"
            >
              Categorías
            </button>
          </li>
          {path.map((s, i) => (
            <li key={s.id} className="flex shrink-0 items-center gap-1">
              <MdChevronRight className="size-4 text-muted" aria-hidden="true" />
              <button
                type="button"
                onClick={() => update({ sectionId: s.id })}
                aria-current={i === path.length - 1 ? 'page' : undefined}
                className="min-h-9 whitespace-nowrap rounded px-2 font-semibold hover:text-accent sm:min-h-11"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {children.length > 0 && (
        <ul className={carouselClass} aria-label="Subcategorías">
          {children.map((s) => (
            <li key={s.id} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => update({ sectionId: s.id })}
                className="inline-flex min-h-9 items-center whitespace-nowrap rounded-full border border-border-strong px-3 text-sm font-semibold hover:border-accent hover:text-accent sm:min-h-11 sm:px-4"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Buscar</span>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setFilters({ ...DEFAULT_FILTERS })
                  setVisibleCount(PAGE_SIZE)
                }}
                className="inline-flex min-h-9 items-center rounded-md border border-border-strong px-3 text-xs font-bold text-fg hover:border-accent hover:text-accent"
              >
                Limpiar filtros
              </button>
            )}
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls="catalog-filters"
              aria-label={filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
              className="relative inline-flex size-9 items-center justify-center rounded-md border border-border-strong text-fg hover:border-accent hover:text-accent aria-expanded:border-accent aria-expanded:text-accent"
            >
              <MdTune className="size-5" aria-hidden="true" />
              {advancedActive && (
                <span
                  className="absolute right-1 top-1 size-2 rounded-full bg-accent-solid"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        </div>
        <div className="relative">
          <MdSearch
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Buscar"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder="Equipo, liga, jugador o #hashtag"
            className={`${inputClass} pl-10`}
          />
        </div>
        {filters.tagId && (
          <button
            type="button"
            onClick={() => update({ tagId: '' })}
            aria-label={`Quitar filtro #${activeTag?.name ?? filters.tagId}`}
            className="inline-flex items-center gap-1 self-start rounded-full bg-accent-solid px-2.5 py-0.5 text-xs font-bold text-on-accent hover:opacity-85"
          >
            #{activeTag?.name ?? filters.tagId}
            <MdClose className="size-3.5" aria-hidden="true" />
          </button>
        )}
        <Collapsible open={filtersOpen} id="catalog-filters">
          <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3">
            <Field label="Ordenar por" className="col-span-2 sm:col-span-1">
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
        </Collapsible>
      </div>

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
