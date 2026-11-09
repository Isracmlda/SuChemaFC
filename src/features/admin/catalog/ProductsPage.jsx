import { useMemo, useState } from 'react'
import { MdAdd, MdDelete, MdEdit, MdRestore, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import { useSearchParams } from 'react-router-dom'
import DriveImage from '../../../components/DriveImage.jsx'
import Field from '../../../components/Field.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { errorMessage } from '../../../utils/errors.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { bulkUpdateProducts } from '../../../services/catalog.js'
import { listCollection } from '../../../services/db.js'
import { formatCRC, normalizeText } from '../../../utils/format.js'
import { btnIcon, btnPrimary, btnSecondary, cardClass, inputClass } from '../../../utils/ui.js'
import { descendantIds } from '../../catalog/search.js'
import ProductForm from './ProductForm.jsx'
import SectionSelector from './SectionSelector.jsx'

const loadProducts = async () => {
  const [products, sections] = await Promise.all([
    listCollection('products'),
    listCollection('sections'),
  ])
  return { products, sections }
}

const STATUS = [
  { value: 'activas', label: 'Activas' },
  { value: 'visibles', label: 'Visibles' },
  { value: 'ocultas', label: 'Ocultas' },
  { value: 'eliminadas', label: 'Eliminadas' },
]

export default function ProductsPage() {
  const { data, loading, error, reload } = useAsync(loadProducts)
  const [params] = useSearchParams()
  // undefined = lista; null = nueva; string = id. `?nueva=1` (botón de Inicio) abre el formulario.
  const [editing, setEditing] = useState(() => (params.get('nueva') ? null : undefined))
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('activas')
  const [sectionId, setSectionId] = useState('')
  const [selected, setSelected] = useState([])
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    if (!data) return []
    const q = normalizeText(search)
    const inSection = sectionId ? descendantIds(data.sections, sectionId) : null
    return data.products
      .filter((p) => {
        if (status === 'eliminadas') return p.deleted
        if (p.deleted) return false
        if (status === 'visibles') return p.visible
        if (status === 'ocultas') return !p.visible
        return true
      })
      .filter((p) => !inSection || p.sectionIds?.some((id) => inSection.has(id)))
      .filter((p) => !q || normalizeText(p.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [data, search, status, sectionId])

  if (editing !== undefined) {
    return (
      <ProductForm
        productId={editing}
        onDone={() => {
          setEditing(undefined)
          setNotice(null)
          reload()
        }}
      />
    )
  }
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const chosen = filtered.filter((p) => selected.includes(p.id))
  const allSelected = filtered.length > 0 && chosen.length === filtered.length
  const toggleOne = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  async function bulk(products, patch, label, okText) {
    setBusy(true)
    setNotice(null)
    try {
      await bulkUpdateProducts(products, patch, label)
      setNotice({ type: 'ok', text: okText })
      setSelected([])
      reload()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  function confirmDelete(products) {
    const what = products.length === 1 ? `"${products[0].name}"` : `${products.length} camisas`
    if (window.confirm(`¿Eliminar ${what}? Podrás restaurarla desde el filtro "Eliminadas".`)) {
      bulk(products, { deleted: true, visible: false }, 'eliminar', 'Eliminada(s).')
    }
  }

  const sectionName = (id) => data.sections.find((s) => s.id === id)?.name

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => setEditing(null)} className={`${btnPrimary} self-start`}>
        <MdAdd className="size-5" aria-hidden="true" />
        Nueva camisa
      </button>

      <div className={`${cardClass} grid gap-3 sm:grid-cols-3`}>
        <Field label="Buscar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre de la camisa"
            className={inputClass}
          />
        </Field>
        <Field label="Estado">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setSelected([])
            }}
            className={inputClass}
          >
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Sección</span>
          <SectionSelector
            sections={data.sections}
            value={sectionId}
            onChange={setSectionId}
            rootLabel="Todas"
          />
        </div>
      </div>

      <Notice notice={notice} />

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? [] : filtered.map((p) => p.id))}
              className="size-4 accent-[var(--accent-solid)]"
            />
            Seleccionar todas ({filtered.length})
          </label>
          {chosen.length > 0 && (
            <>
              <span className="text-sm text-muted">{chosen.length} seleccionada(s):</span>
              {status === 'eliminadas' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => bulk(chosen, { deleted: false }, 'restaurar', 'Restaurada(s).')}
                  className={btnSecondary}
                >
                  <MdRestore className="size-5" aria-hidden="true" />
                  Restaurar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => bulk(chosen, { visible: true }, 'mostrar', 'Ahora visibles.')}
                    className={btnSecondary}
                  >
                    <MdVisibility className="size-5" aria-hidden="true" />
                    Mostrar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => bulk(chosen, { visible: false }, 'ocultar', 'Ahora ocultas.')}
                    className={btnSecondary}
                  >
                    <MdVisibilityOff className="size-5" aria-hidden="true" />
                    Ocultar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => confirmDelete(chosen)}
                    className={btnSecondary}
                  >
                    <MdDelete className="size-5" aria-hidden="true" />
                    Eliminar
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState>
          {data.products.length === 0
            ? 'Aún no hay camisas. Crea la primera.'
            : 'Ninguna camisa coincide con los filtros.'}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((p) => (
            <li key={p.id} className={`${cardClass} flex flex-wrap items-center gap-3`}>
              <input
                type="checkbox"
                aria-label={`Seleccionar ${p.name}`}
                checked={selected.includes(p.id)}
                onChange={() => toggleOne(p.id)}
                className="size-4 accent-[var(--accent-solid)]"
              />
              <DriveImage
                id={p.images?.[0]}
                size={160}
                alt=""
                className="size-16 shrink-0 rounded-md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-sm text-muted">
                  {formatCRC(p.price)}
                  {p.sectionIds?.length > 0 &&
                    ` · ${p.sectionIds.map(sectionName).filter(Boolean).join(', ')}`}
                  {!p.deleted && !p.visible && ' · oculta'}
                  {p.deleted && ' · eliminada'}
                </p>
              </div>
              {p.deleted ? (
                <button
                  type="button"
                  aria-label={`Restaurar ${p.name}`}
                  title="Restaurar"
                  disabled={busy}
                  onClick={() => bulk([p], { deleted: false }, 'restaurar', 'Restaurada.')}
                  className={btnIcon}
                >
                  <MdRestore className="size-5" aria-hidden="true" />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    aria-label={`Editar ${p.name}`}
                    title="Editar"
                    onClick={() => setEditing(p.id)}
                    className={btnIcon}
                  >
                    <MdEdit className="size-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={p.visible ? `Ocultar ${p.name}` : `Mostrar ${p.name}`}
                    title={p.visible ? 'Ocultar' : 'Mostrar'}
                    disabled={busy}
                    onClick={() =>
                      bulk(
                        [p],
                        { visible: !p.visible },
                        p.visible ? 'ocultar' : 'mostrar',
                        p.visible ? 'Oculta.' : 'Visible.',
                      )
                    }
                    className={btnIcon}
                  >
                    {p.visible ? (
                      <MdVisibility className="size-5" aria-hidden="true" />
                    ) : (
                      <MdVisibilityOff className="size-5" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar ${p.name}`}
                    title="Eliminar"
                    disabled={busy}
                    onClick={() => confirmDelete([p])}
                    className={btnIcon}
                  >
                    <MdDelete className="size-5" aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
