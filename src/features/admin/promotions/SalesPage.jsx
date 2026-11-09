import { useMemo, useState } from 'react'
import { MdDelete, MdLocalOffer } from 'react-icons/md'
import DriveImage from '../../../components/DriveImage.jsx'
import Field from '../../../components/Field.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { isSaleActive } from '../../catalog/salePrice.js'
import { DEFAULT_BASE_VARIANT_NAME } from '../../catalog/variants.js'
import {
  SALE_MODES,
  buildSale,
  saleScope,
  saleState,
  validateSaleInput,
} from '../../pricing/sale.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { listCollection } from '../../../services/db.js'
import { applySales } from '../../../services/promotions.js'
import { clearCatalogCache, normalizeProduct } from '../../../services/storefront.js'
import { formatDateTime, fromInputValue } from '../../../utils/dates.js'
import { errorMessage } from '../../../utils/errors.js'
import { formatCRC, normalizeText, toInt } from '../../../utils/format.js'
import { btnPrimary, btnSecondary, cardClass, inputClass } from '../../../utils/ui.js'

const load = async () => {
  const products = await listCollection('products')
  return products.filter((p) => !p.deleted).map(normalizeProduct)
}

const STATE_LABEL = {
  active: 'Oferta activa',
  scheduled: 'Programada',
  expired: 'Vencida',
  none: '',
}
const FILTERS = [
  { value: 'todas', label: 'Todas' },
  { value: 'con-oferta', label: 'Con oferta (activa o programada)' },
  { value: 'sin-oferta', label: 'Sin oferta vigente' },
]

const EMPTY_FORM = { mode: 'percent', value: 10, startsAt: '', endsAt: '', countdown: false }

/** Estado de oferta de cada alcance de una camisa (la base y cada versión, visibles u ocultas). */
const scopeStates = (p) => [
  saleState(p),
  ...(p.variants ?? []).filter((v) => v?.id).map((v) => saleState(p, undefined, v.id)),
]

/** Línea con la oferta de una versión (precio de la versión, tachado si está activa). */
function VariantSaleLine({ product, variant }) {
  const scope = saleScope(product, variant.id)
  const state = saleState(product, undefined, variant.id)
  return (
    <p className="text-sm text-muted">
      {variant.name}:{' '}
      {state === 'active' ? (
        <>
          <s>{formatCRC(scope.price)}</s> {formatCRC(scope.sale.price)}
        </>
      ) : (
        formatCRC(scope.price)
      )}
      {state !== 'none' && ` · ${STATE_LABEL[state]}`}
      {scope.sale?.endsAt && state !== 'expired' && ` · hasta ${formatDateTime(scope.sale.endsAt)}`}
      {variant.visible === false && ' · oculta'}
    </p>
  )
}

export default function SalesPage() {
  const { data, loading, error, reload } = useAsync(load)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todas')
  const [selected, setSelected] = useState([])
  const [scopes, setScopes] = useState({}) // id de camisa → id de versión ('' = camisa base)
  const [form, setForm] = useState(EMPTY_FORM)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const visible = useMemo(() => {
    if (!data) return []
    const q = normalizeText(search)
    return data
      .filter((p) => !q || normalizeText(p.name).includes(q))
      .filter((p) => {
        const states = scopeStates(p)
        const has = (s) => states.some((x) => x === s)
        if (filter === 'con-oferta') return has('active') || has('scheduled')
        if (filter === 'sin-oferta') return !has('active') && !has('scheduled')
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [data, search, filter])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const chosen = visible.filter((p) => selected.includes(p.id))
  const allSelected = visible.length > 0 && chosen.length === visible.length
  const input = {
    mode: form.mode,
    value: toInt(form.value),
    startsAt: fromInputValue(form.startsAt),
    endsAt: fromInputValue(form.endsAt),
    countdown: form.countdown,
  }
  const problem = validateSaleInput(input)
  const toggleOne = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  // Alcance elegido para una camisa; si la versión ya no existe vuelve a la base.
  const scopeOf = (p) => {
    const id = scopes[p.id] ?? ''
    return id && saleScope(p, id) ? id : ''
  }

  async function run(products, sales, label, okText) {
    setBusy(true)
    setNotice(null)
    try {
      await applySales(products, sales, label)
      clearCatalogCache()
      setNotice({ type: 'ok', text: okText })
      setSelected([])
      reload()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  function apply() {
    // Con precio fijo, las camisas que ya cuestan igual o menos se omiten en vez de fallar todo.
    const sales = new Map()
    const skipped = []
    for (const p of chosen) {
      const variantId = scopeOf(p) || null
      const sale = buildSale(p, input, variantId)
      if (sale) sales.set(p.id, [{ variantId, sale }])
      else skipped.push(p.name)
    }
    if (sales.size === 0) {
      setNotice({ type: 'error', text: 'Con ese valor ninguna camisa queda con precio rebajado.' })
      return
    }
    const applied = chosen.filter((p) => sales.has(p.id))
    run(
      applied,
      sales,
      'oferta',
      skipped.length
        ? `Oferta aplicada a ${applied.length}. Omitidas por no quedar rebajadas: ${skipped.join(', ')}.`
        : `Oferta aplicada a ${applied.length} camisa(s).`,
    )
  }

  function remove(products) {
    if (!window.confirm(`¿Quitar la oferta de ${products.length} camisa(s)?`)) return
    const removals = new Map(
      products.map((p) => [p.id, [{ variantId: scopeOf(p) || null, sale: null }]]),
    )
    run(products, removals, 'quitar oferta', 'Oferta quitada.')
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={`${cardClass} flex flex-col gap-3`} aria-labelledby="sale-form-title">
        <h2 id="sale-form-title" className="text-lg font-bold">
          Oferta para las camisas seleccionadas
        </h2>
        <p className="text-sm text-muted">
          La oferta se aplica a la camisa base de cada seleccionada. Si una camisa tiene versiones,
          elige en su fila si la oferta va a la base o a una versión concreta. La oferta de la base
          no se hereda a las versiones: cada versión se vende a su precio normal salvo que tenga la
          suya.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <select
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value, value: 0 })}
              className={inputClass}
            >
              {SALE_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={form.mode === 'percent' ? 'Descuento (%)' : 'Precio de oferta (₡)'}
            hint={form.mode === 'percent' ? 'Entero de 1 a 90.' : 'Debe ser menor al precio base.'}
          >
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Desde (opcional)" hint="Vacío = desde ahora.">
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Hasta (opcional)" hint="Vacío = sin fecha de fin.">
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.countdown}
            onChange={(e) => setForm({ ...form, countdown: e.target.checked })}
            className="size-4 accent-[var(--accent-solid)]"
          />
          Mostrar cuenta regresiva en el detalle de la camisa
        </label>
        {problem && <p className="text-sm text-muted">{problem}</p>}
        <Notice notice={notice} />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || chosen.length === 0 || Boolean(problem)}
            onClick={apply}
            className={btnPrimary}
          >
            <MdLocalOffer className="size-5" aria-hidden="true" />
            Aplicar a {chosen.length} seleccionada(s)
          </button>
          <button
            type="button"
            disabled={busy || chosen.length === 0}
            onClick={() => remove(chosen)}
            className={btnSecondary}
          >
            <MdDelete className="size-5" aria-hidden="true" />
            Quitar oferta
          </button>
        </div>
      </section>

      <div className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <Field label="Buscar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre de la camisa"
            className={inputClass}
          />
        </Field>
        <Field label="Mostrar">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={inputClass}>
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {visible.length === 0 ? (
        <EmptyState>
          {data.length === 0 ? 'Aún no hay camisas.' : 'Ninguna camisa coincide con los filtros.'}
        </EmptyState>
      ) : (
        <>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? [] : visible.map((p) => p.id))}
              className="size-4 accent-[var(--accent-solid)]"
            />
            Seleccionar todas ({visible.length})
          </label>
          <ul className="flex flex-col gap-2">
            {visible.map((p) => {
              const state = saleState(p)
              const variants = (p.variants ?? []).filter((v) => v?.id)
              return (
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
                    className="size-14 shrink-0 rounded-md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-sm text-muted">
                      {variants.length > 0 && `${p.baseVariantName || DEFAULT_BASE_VARIANT_NAME}: `}
                      {isSaleActive(p) ? (
                        <>
                          <s>{formatCRC(p.price)}</s> {formatCRC(p.sale.price)}
                        </>
                      ) : (
                        formatCRC(p.price)
                      )}
                      {state !== 'none' && ` · ${STATE_LABEL[state]}`}
                      {p.sale?.endsAt &&
                        state !== 'expired' &&
                        ` · hasta ${formatDateTime(p.sale.endsAt)}`}
                      {!p.visible && ' · oculta'}
                    </p>
                    {variants.map((v) => (
                      <VariantSaleLine key={v.id} product={p} variant={v} />
                    ))}
                  </div>
                  {variants.length > 0 && (
                    <select
                      aria-label={`Alcance de la oferta para ${p.name}`}
                      value={scopeOf(p)}
                      onChange={(e) => setScopes({ ...scopes, [p.id]: e.target.value })}
                      className={`${inputClass} w-auto max-w-full`}
                    >
                      <option value="">
                        Base: {p.baseVariantName || DEFAULT_BASE_VARIANT_NAME}
                      </option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          Versión: {v.name}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
