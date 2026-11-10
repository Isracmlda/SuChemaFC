import { useMemo, useState } from 'react'
import {
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdDeleteForever,
  MdCalculate,
  MdDownload,
  MdExpandLess,
  MdExpandMore,
  MdQrCode2,
  MdSave,
  MdWhatsapp,
} from 'react-icons/md'
import Collapsible from '../../../components/Collapsible.jsx'
import Field from '../../../components/Field.jsx'
import FilterPanel from '../../../components/FilterPanel.jsx'
import { EmptyState, ErrorState, Loading, Notice } from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { useDialog } from '../../../hooks/useDialog.js'
import { DEFAULTS_DOC_ID } from '../../../services/catalog.js'
import { listCollection } from '../../../services/db.js'
import { listOrders } from '../../../services/adminOrders.js'
import { notifySupplierUpdate } from '../../../services/notifications.js'
import {
  createSupplierOrder,
  deleteSupplierOrder,
  listSupplierOrders,
  updateSupplierOrder,
} from '../../../services/supplierOrders.js'
import {
  formatDateTime,
  fromDayValue,
  fromInputValue,
  toDayValue,
  toInputValue,
} from '../../../utils/dates.js'
import { errorMessage } from '../../../utils/errors.js'
import { formatCRC, toInt } from '../../../utils/format.js'
import {
  actionRowClass,
  actionStackClass,
  btnDanger,
  btnPrimary,
  btnSecondary,
  cardClass,
  inputClass,
} from '../../../utils/ui.js'
import { describeCustom } from '../../personalization/personalization.js'
import {
  DEFAULT_MESSAGE,
  SUPPLIER_STATUS,
  affectedOrderIds,
  buildCsv,
  customerNotices,
  defaultEstimate,
  defaultUnitCost,
  describeCost,
  filterPending,
  groupLines,
  pendingLines,
  supplierLabel,
  supplierSummary,
  validateSupplierForm,
} from './supplier.js'
import LabelsModal from './LabelsModal.jsx'

async function loadAll() {
  const [orders, supplierOrders, allPrivates] = await Promise.all([
    listOrders(),
    listSupplierOrders(),
    listCollection('productPrivate'),
  ])
  const privates = allPrivates.filter((p) => p.id !== DEFAULTS_DOC_ID)
  const costs = Object.fromEntries(privates.map((p) => [p.id, p.cost ?? 0]))
  const variantCosts = Object.fromEntries(
    privates.filter((p) => p.variantCosts).map((p) => [p.id, p.variantCosts]),
  )
  return { orders, supplierOrders, costs, variantCosts }
}

function downloadCsv(supplierOrder) {
  const blob = new Blob([buildCsv(supplierOrder)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pedido-proveedor-${supplierOrder.id.slice(0, 6)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const extras = (l) =>
  [...l.patches, l.custom ? `personalizada ${describeCustom(l.custom)}` : '']
    .filter(Boolean)
    .join(', ')

/**
 * Cálculos de costos y ganancia en fichas compactas. Empieza oculto: el botón los muestra y los
 * oculta. `rows` son [título, valor, detalle opcional]; la última ficha (ganancia) se resalta.
 */
function CostBreakdown({ rows, lead = null }) {
  const [open, setOpen] = useState(false)
  const Icon = open ? MdExpandLess : MdExpandMore
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-3">
        {lead}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={btnSecondary}
        >
          <MdCalculate className="size-5" aria-hidden="true" />
          {open ? 'Ocultar cálculos' : 'Ver cálculos'}
          <Icon className="size-5" aria-hidden="true" />
        </button>
      </div>
      <Collapsible open={open}>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
          {rows.map(([title, value, detail], i) => (
            <div
              key={title}
              className={`rounded-md border px-3 py-2 ${
                i === rows.length - 1 ? 'border-accent bg-surface-2' : 'border-border bg-bg'
              }`}
            >
              <dt className="text-muted">{title}</dt>
              <dd className="font-bold">{value}</dd>
              {detail && <dd className="text-xs text-muted">{detail}</dd>}
            </div>
          ))}
        </dl>
      </Collapsible>
    </div>
  )
}

function NewSupplierOrder({ data, onDone }) {
  const pending = useMemo(
    () => pendingLines(data.orders, data.supplierOrders),
    [data.orders, data.supplierOrders],
  )
  const [query, setQuery] = useState('')
  const [size, setSize] = useState('')
  const [selected, setSelected] = useState([])
  const [costs, setCosts] = useState({})
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [importCost, setImportCost] = useState(0)
  const [showDetails, setShowDetails] = useState(false)
  const [estimate, setEstimate] = useState(toInputValue(defaultEstimate()).slice(0, 10))
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const shown = filterPending(pending, { query, size })
  const sizes = [...new Set(pending.map((l) => l.size))].sort()
  const chosen = pending
    .filter((l) => selected.includes(l.key))
    .map((l) => ({
      ...l,
      unitCost: costs[l.key] ?? defaultUnitCost(l, data.costs, data.variantCosts),
    }))
  const form = {
    supplier,
    notes,
    // Solo fecha: se toma el mediodía local para que ninguna zona horaria la corra de día.
    estimatedDate: fromInputValue(estimate ? `${estimate}T12:00` : ''),
    lines: chosen,
    importCost,
  }
  const productCost = chosen.reduce((n, l) => n + l.qty * l.unitCost, 0)
  const units = chosen.reduce((n, l) => n + l.qty, 0)
  const revenue = chosen.reduce((n, l) => n + l.qty * (l.unitPrice ?? 0), 0)
  const problem = validateSupplierForm(form)

  const toggle = (key) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const { changes } = await createSupplierOrder(form, data)
      onDone({
        type: 'ok',
        text: `Pedido al proveedor creado. ${changes.length} pedidos de clientes pasaron a "pedido al proveedor".`,
      })
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="pending-title">
      <h2 id="pending-title" className="text-lg font-bold">
        Por pedir al proveedor
      </h2>
      {pending.length === 0 ? (
        <EmptyState>No hay camisas con adelanto confirmado pendientes de pedir.</EmptyState>
      ) : (
        <>
          <div className={`${cardClass} flex flex-col gap-1 text-sm`}>
            <p className="font-semibold">Resumen por camisa y talla</p>
            <ul className="grid gap-x-4 sm:grid-cols-2">
              {groupLines(pending).map((g) => (
                <li key={g.key}>
                  {g.qty} × {g.name} ({g.size})
                </li>
              ))}
            </ul>
          </div>

          <FilterPanel
            gridClass="sm:grid-cols-2"
            active={Boolean(query) || Boolean(size)}
            onClear={() => {
              setQuery('')
              setSize('')
            }}
            search={
              <Field label="Buscar" hint="Camisa, cliente o referencia.">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={inputClass}
                />
              </Field>
            }
          >
            <Field label="Talla">
              <select value={size} onChange={(e) => setSize(e.target.value)} className={inputClass}>
                <option value="">Todas</option>
                {sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </FilterPanel>

          <div className={actionRowClass}>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setSelected((s) => [...new Set([...s, ...shown.map((l) => l.key)])])}
            >
              Elegir las {shown.length} mostradas
            </button>
            <button type="button" className={btnSecondary} onClick={() => setSelected([])}>
              Quitar selección
            </button>
            <button
              type="button"
              aria-pressed={showDetails}
              className={btnSecondary}
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails ? 'Ocultar detalles' : 'Mostrar detalles'}
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {shown.map((l) => {
              const on = selected.includes(l.key)
              const Icon = on ? MdCheckBox : MdCheckBoxOutlineBlank
              return (
                <li key={l.key} className={`${cardClass} flex flex-wrap items-center gap-3`}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(l.key)}
                    className="flex min-h-11 flex-1 items-center gap-2 text-start"
                  >
                    <Icon className="size-6 shrink-0 text-accent" aria-hidden="true" />
                    <span>
                      <span className="font-semibold">
                        {l.qty} × {l.name} ({l.size})
                      </span>
                      {showDetails && (
                        <span className="block text-sm text-muted">
                          {l.customerName} · {l.orderRef}
                          {extras(l) && ` · ${extras(l)}`}
                        </span>
                      )}
                    </span>
                  </button>
                  {on && (
                    <Field label="Costo unitario (₡)" className="w-40">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={costs[l.key] ?? defaultUnitCost(l, data.costs, data.variantCosts)}
                        onChange={(e) => setCosts({ ...costs, [l.key]: toInt(e.target.value) })}
                        className={inputClass}
                      />
                    </Field>
                  )}
                </li>
              )
            })}
          </ul>

          <form onSubmit={submit} className={`${cardClass} flex flex-col gap-3`}>
            <h3 className="font-bold">Crear pedido ({chosen.length} líneas elegidas)</h3>
            <div className="grid grid-cols-[minmax(0,1fr)_9.5rem] gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <Field label="Proveedor">
                <input
                  required
                  maxLength={100}
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Llegada">
                <input
                  type="date"
                  value={estimate}
                  onChange={(e) => setEstimate(e.target.value)}
                  className={`${inputClass} px-2`}
                />
              </Field>
            </div>
            <CostBreakdown
              lead={
                <Field label="Importación total (₡)" className="min-w-0 flex-1">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={importCost || ''}
                    placeholder="0"
                    onChange={(e) => setImportCost(toInt(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              }
              rows={[
                ['Camisas', formatCRC(productCost)],
                [
                  'Importación',
                  formatCRC(importCost),
                  units > 0 ? `${formatCRC(importCost / units)} por camisa` : '',
                ],
                ['Costo total', formatCRC(productCost + importCost)],
                ['Venta', formatCRC(revenue)],
                ['Ganancia', formatCRC(revenue - productCost - importCost)],
              ]}
            />
            <Field label="Notas">
              <input
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={busy || Boolean(problem)}
                className={`${btnPrimary} w-full sm:w-auto`}
              >
                <MdSave className="size-5" aria-hidden="true" />
                {busy ? 'Guardando…' : 'Crear pedido al proveedor'}
              </button>
              {chosen.length > 0 && problem && <p className="text-sm text-danger">⚠ {problem}</p>}
            </div>
            <Notice notice={notice} />
          </form>
        </>
      )}
    </section>
  )
}

function SupplierOrderCard({ so, data, onChanged }) {
  const dialog = useDialog()
  const [status, setStatus] = useState(so.status)
  const [estimate, setEstimate] = useState(toDayValue(so.estimatedDate))
  const [note, setNote] = useState('')
  const [template, setTemplate] = useState(DEFAULT_MESSAGE)
  const [showNotices, setShowNotices] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const orders = data.orders.filter((o) => affectedOrderIds(so).includes(o.id))
  const summary = supplierSummary(so)
  const dirty =
    status !== so.status || estimate !== toDayValue(so.estimatedDate) || Boolean(note.trim())
  // Sin cambios en el día se conserva el valor guardado; si no, el día elegido (a las 12:00).
  const estimateMs = () =>
    estimate === toDayValue(so.estimatedDate) ? so.estimatedDate : fromDayValue(estimate)

  async function save() {
    setBusy(true)
    setNotice(null)
    try {
      const { changes } = await updateSupplierOrder(
        so,
        { status, estimatedDate: estimateMs(), note },
        data,
      )
      // Correo a cada cliente con camisas en este pedido (leído desde Firestore por el script).
      const mailed = await notifySupplierUpdate(so.id, note.trim())
      onChanged({
        type: mailed ? 'ok' : 'error',
        text: `Pedido actualizado. ${changes.length} pedidos de clientes cambiaron de estado y todos vieron la nueva fecha en su rastreo. ${
          mailed ? 'Se avisó a los clientes por correo.' : 'No se pudieron enviar los correos.'
        }`,
      })
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
      setBusy(false)
    }
  }

  async function remove() {
    const yes = await dialog.confirm({
      title: 'Eliminar pedido al proveedor',
      message: `¿Eliminar el pedido a ${so.supplier}? Sus camisas vuelven a "por pedir" y los pedidos de clientes que dependían de él retroceden de estado. No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!yes) return
    setBusy(true)
    setNotice(null)
    try {
      const { reverted } = await deleteSupplierOrder(so, data)
      onChanged({
        type: 'ok',
        text: `Pedido a ${so.supplier} eliminado. ${reverted} pedidos de clientes retrocedieron de estado.`,
      })
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
      setBusy(false)
    }
  }

  const notices = showNotices
    ? customerNotices(
        orders,
        { ...so, status, estimatedDate: estimateMs() },
        { template, origin: window.location.origin },
      )
    : []

  return (
    <li className={`${cardClass} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">
            {so.supplier} · {supplierLabel(so.status)}
          </p>
          <p className="text-sm text-muted">
            {formatDateTime(so.createdAt)} · {describeCost(so)} · {orders.length} pedidos de
            clientes
          </p>
        </div>
        <button type="button" onClick={() => downloadCsv(so)} className={btnSecondary}>
          <MdDownload className="size-5" aria-hidden="true" />
          CSV
        </button>
      </div>
      {so.notes && <p className="text-sm">{so.notes}</p>}
      <CostBreakdown
        rows={[
          ['Camisas', formatCRC(summary.productCost)],
          [
            'Importación',
            formatCRC(summary.importCost),
            `${formatCRC(summary.importPerUnit)} por camisa`,
          ],
          ['Costo total', formatCRC(summary.totalCost)],
          ...(summary.profit != null
            ? [
                ['Venta', formatCRC(summary.revenue)],
                ['Ganancia', formatCRC(summary.profit)],
              ]
            : []),
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            {Object.entries(SUPPLIER_STATUS).map(([value, s]) => (
              <option key={value} value={value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha estimada">
          <input
            type="date"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Novedad para los clientes (opcional)" hint="Se muestra en su rastreo.">
        <input
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Notice notice={notice} />
      <div className={actionStackClass}>
        <button type="button" onClick={save} disabled={busy || !dirty} className={btnPrimary}>
          <MdSave className="size-5" aria-hidden="true" />
          {busy ? 'Guardando…' : 'Guardar y avisar al rastreo'}
        </button>
        <button type="button" onClick={() => setShowNotices((v) => !v)} className={btnSecondary}>
          <MdWhatsapp className="size-5" aria-hidden="true" />
          {showNotices ? 'Ocultar avisos' : 'Avisos por WhatsApp'}
        </button>
        {so.status === 'llego' && (
          <button type="button" onClick={() => setShowLabels(true)} className={btnSecondary}>
            <MdQrCode2 className="size-5" aria-hidden="true" />
            Etiquetas de entrega
          </button>
        )}
        <button type="button" onClick={remove} disabled={busy} className={btnDanger}>
          <MdDeleteForever className="size-5" aria-hidden="true" />
          Eliminar pedido
        </button>
      </div>

      <LabelsModal
        open={showLabels}
        onClose={() => setShowLabels(false)}
        supplierOrder={so}
        orders={data.orders}
      />

      {showNotices && (
        <div className="flex flex-col gap-2">
          <Field
            label="Mensaje"
            hint="Puedes usar {nombre}, {pedido}, {estado}, {fecha} y {enlace}."
          >
            <textarea
              rows={4}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className={`${inputClass} py-2`}
            />
          </Field>
          <ul className="flex flex-col gap-2">
            {notices.map((n) => (
              <li
                key={n.orderId}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  {n.name} · {n.phone}
                </span>
                {n.link ? (
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btnSecondary}
                  >
                    <MdWhatsapp className="size-5" aria-hidden="true" />
                    Avisar
                  </a>
                ) : (
                  <span className="text-danger">Teléfono no válido</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

/** Pedidos a proveedor: camisas por pedir, creación, seguimiento y avisos. */
export default function SupplierPage() {
  const { data, loading, error, reload } = useAsync(loadAll)
  const [notice, setNotice] = useState(null)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const done = (n) => {
    setNotice(n)
    reload()
  }

  return (
    <div className="flex flex-col gap-6">
      <Notice notice={notice} />
      <NewSupplierOrder key={data.supplierOrders.length} data={data} onDone={done} />
      <section className="flex flex-col gap-3" aria-labelledby="sent-title">
        <h2 id="sent-title" className="text-lg font-bold">
          Pedidos al proveedor
        </h2>
        {data.supplierOrders.length === 0 ? (
          <EmptyState>Aún no has creado pedidos al proveedor.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.supplierOrders.map((so) => (
              <SupplierOrderCard key={so.id} so={so} data={data} onChanged={done} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
