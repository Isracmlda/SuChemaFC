import { useCallback, useState } from 'react'
import {
  MdArrowBack,
  MdCancel,
  MdCheckCircle,
  MdDeleteForever,
  MdDeleteSweep,
  MdReceiptLong,
  MdSave,
  MdThumbDown,
  MdWhatsapp,
} from 'react-icons/md'
import StatusBadge from '../../../components/StatusBadge.jsx'
import {
  EmptyState,
  ErrorState,
  InlineNotice,
  Loading,
  Notice,
} from '../../../components/States.jsx'
import { useAsync } from '../../../hooks/useAsync.js'
import { useDialog } from '../../../hooks/useDialog.js'
import {
  cancelOrder,
  confirmPayment,
  deleteOrder,
  deleteReceipt,
  findPaymentRef,
  listOrders,
  loadOrderNotes,
  rejectPayment,
  saveOrderNotes,
} from '../../../services/adminOrders.js'
import { getReceiptDataUrl } from '../../../services/drive.js'
import { formatDateTime, toMillis } from '../../../utils/dates.js'
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
import { SHIPPING_METHODS, orderRef } from '../../checkout/checkout.js'
import { describeCustom } from '../../personalization/personalization.js'
import { ORDER_STATUS } from '../../orders/orderStatus.js'
import Field from '../../../components/Field.jsx'
import FilterPanel from '../../../components/FilterPanel.jsx'
import { emailReceipt } from '../receipts/receiptActions.js'
import OrderReceipt from './OrderReceipt.jsx'
import {
  advanceMissing,
  balance,
  canCancel,
  canConfirmPayment,
  canIssueReceipt,
  canReject,
  countByStatus,
  customerWhatsApp,
  filterOrders,
  normalizeReference,
  totalPaid,
  validatePaymentForm,
} from './review.js'

const load = () => listOrders()

function Row({ label, children }) {
  return (
    <p>
      <span className="text-muted">{label}: </span>
      {children}
    </p>
  )
}

function Receipt({ order }) {
  const [state, setState] = useState({ url: '', loading: false, error: null })

  async function show() {
    setState({ url: '', loading: true, error: null })
    try {
      setState({ url: await getReceiptDataUrl(order.receiptFileId), loading: false, error: null })
    } catch (e) {
      setState({ url: '', loading: false, error: e })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {!state.url && (
        <button type="button" onClick={show} disabled={state.loading} className={btnSecondary}>
          <MdReceiptLong className="size-5" aria-hidden="true" />
          {state.loading ? 'Cargando…' : 'Ver comprobante'}
        </button>
      )}
      {state.error && <Notice notice={{ type: 'error', text: errorMessage(state.error) }} />}
      {state.url && (
        <img
          src={state.url}
          alt={`Comprobante de pago del pedido ${orderRef(order.id)}`}
          className="max-h-96 w-full rounded-md border border-border object-contain"
        />
      )}
    </div>
  )
}

function PaymentForm({ order, onSaved }) {
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState(advanceMissing(order) || balance(order))
  const [duplicate, setDuplicate] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const problem = validatePaymentForm(order, { reference, amount })

  async function checkDuplicate() {
    const found = reference.trim() ? await findPaymentRef(reference).catch(() => null) : null
    setDuplicate(found)
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    let result
    try {
      result = await confirmPayment(order, { reference, amount })
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
      return
    } finally {
      setBusy(false)
    }
    // Pago guardado: el padre reemplaza este formulario y sigue con Drive y el correo aparte.
    onSaved(result)
  }

  return (
    <form onSubmit={submit} className={`${cardClass} flex flex-col gap-3`}>
      <h3 className="font-bold">Comprobar pago</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Número de comprobante" hint="Debe ser único: sirve para detectar repetidos.">
          <input
            required
            value={reference}
            onChange={(e) => setReference(normalizeReference(e.target.value))}
            onBlur={checkDuplicate}
            autoComplete="off"
            className={`${inputClass} font-mono`}
          />
        </Field>
        <Field
          label="Monto recibido (₡)"
          hint={`Adelanto mínimo faltante: ${formatCRC(advanceMissing(order))}.`}
        >
          <input
            required
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(toInt(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>
      {duplicate && (
        <InlineNotice
          notice={{
            type: 'error',
            text: `Comprobante duplicado: ya se usó en el pedido ${orderRef(duplicate.orderId)}.`,
          }}
        />
      )}
      {reference && problem && <p className="text-sm text-danger">⚠ {problem}</p>}
      <Notice notice={notice} />
      <button
        type="submit"
        disabled={busy || Boolean(problem) || Boolean(duplicate)}
        className={btnPrimary}
      >
        <MdCheckCircle className="size-5" aria-hidden="true" />
        {busy ? 'Guardando…' : 'Comprobar y confirmar'}
      </button>
    </form>
  )
}

/** Formulario de motivo (rechazar o cancelar). `onClose` lo cierra sin enviar. */
function ReasonForm({ label, icon: Icon, danger, placeholder, required, onSubmit, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit(reason)
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${cardClass} flex flex-col gap-2`}>
      <Field label={`${label}: motivo`} hint="El cliente lo verá en su rastreo.">
        <textarea
          required={required}
          rows={2}
          maxLength={200}
          value={reason}
          placeholder={placeholder}
          onChange={(e) => setReason(e.target.value)}
          className={`${inputClass} py-2`}
        />
      </Field>
      {error && <Notice notice={{ type: 'error', text: errorMessage(error) }} />}
      <div className={actionRowClass}>
        <button type="submit" disabled={busy} className={danger ? btnDanger : btnPrimary}>
          <Icon className="size-5" aria-hidden="true" />
          {busy ? 'Guardando…' : label}
        </button>
        <button type="button" onClick={onClose} className={btnSecondary}>
          Volver
        </button>
      </div>
    </form>
  )
}

function ReasonAction(props) {
  const { label, icon: Icon, danger } = props
  const [open, setOpen] = useState(false)
  if (open) return <ReasonForm {...props} onClose={() => setOpen(false)} />
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={danger ? btnDanger : btnSecondary}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </button>
  )
}

function Notes({ order }) {
  const loadNotes = useCallback(() => loadOrderNotes(order.id), [order.id])
  const notes = useAsync(loadNotes)
  if (notes.loading) return <Loading />
  if (notes.error) return <ErrorState error={notes.error} onRetry={notes.reload} />
  return <NotesForm key={order.id} order={order} initial={notes.data} />
}

function NotesForm({ order, initial }) {
  const [text, setText] = useState(initial)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setNotice(null)
    try {
      await saveOrderNotes(order, text)
      setNotice({ type: 'ok', text: 'Notas guardadas.' })
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`${cardClass} flex flex-col gap-2`}>
      <Field label="Notas internas">
        <div className="relative">
          <textarea
            rows={4}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${inputClass} py-2 pb-12`}
          />
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className={`${btnSecondary} absolute bottom-2 right-2 min-h-9! bg-surface px-3!`}
          >
            <MdSave className="size-5" aria-hidden="true" />
            {busy ? 'Guardando…' : 'Guardar notas'}
          </button>
        </div>
      </Field>
      <Notice notice={notice} />
    </div>
  )
}

function OrderDetail({ order, onBack, onChanged, onDeleted }) {
  const dialog = useDialog()
  const [notice, setNotice] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [rejectLink, setRejectLink] = useState('')
  // Tras guardar un pago: { order (ya con el pago), drive, mail } con el avance de lo que sigue.
  const [paid, setPaid] = useState(null)
  const origin = window.location.origin
  const addr = order.customer?.address
  const done = (n) => {
    setNotice(n)
    onChanged()
  }

  // Pedido con el pago recién guardado, hasta que la lista recargada lo traiga.
  const current =
    paid && (order.payments?.length ?? 0) < paid.order.payments.length ? paid.order : order

  /**
   * El pago ya quedó guardado: la pantalla cambia enseguida y el borrado de Drive y el correo siguen
   * por separado, para que una respuesta lenta del script no deje la pantalla esperando. El correo
   * (con el recibo adjunto) solo sale si el pago dejó el pedido confirmado; un pago parcial no lo manda.
   */
  function onPaymentSaved(result) {
    const updated = {
      ...order,
      payments: result.payments,
      paidAmount: result.paidAmount,
      status: result.status,
    }
    const sendsMail = result.statusChanged && Boolean(order.customer?.email)
    const step = (patch) => setPaid((p) => p && { ...p, ...patch })
    setPaid({
      order: updated,
      drive: order.receiptFileId ? 'working' : 'none',
      mail: sendsMail ? 'working' : 'none',
    })
    onChanged()
    if (order.receiptFileId) {
      deleteReceipt(order).then(
        () => {
          step({ drive: 'ok' })
          onChanged()
        },
        (e) => step({ drive: 'error', driveError: errorMessage(e) }),
      )
    }
    if (sendsMail) {
      emailReceipt(updated).then((ok) => step({ mail: ok ? 'ok' : 'error' }))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className={`${btnSecondary} self-start`}>
        <MdArrowBack className="size-5" aria-hidden="true" />
        Volver a pedidos
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">Pedido {orderRef(order.id)}</h2>
        <StatusBadge status={order.status} />
        {order.deleted && <span className="text-sm text-danger">(cancelado)</span>}
      </div>
      <Notice notice={notice} />

      <section className={`${cardClass} flex flex-col gap-1 text-sm`}>
        <h3 className="mb-1 font-bold">Cliente</h3>
        <Row label="Nombre">{order.customer?.name}</Row>
        <Row label="Teléfono">{order.customer?.phone}</Row>
        {order.customer?.email && <Row label="Correo">{order.customer.email}</Row>}
        <Row label="Entrega">{SHIPPING_METHODS[order.shippingMethod]}</Row>
        {addr && (
          <Row label="Dirección">
            {[addr.province, addr.canton, addr.district, addr.details].filter(Boolean).join(', ')}
          </Row>
        )}
        {order.customerNote && <Row label="Nota del cliente">{order.customerNote}</Row>}
        <Row label="Fecha">{formatDateTime(toMillis(order.createdAt))}</Row>
      </section>

      <section className={`${cardClass} flex flex-col gap-2 text-sm`}>
        <h3 className="font-bold">Camisas</h3>
        <ul className="flex flex-col gap-2">
          {order.lines.map((l, i) => (
            <li
              key={i}
              className="flex flex-wrap justify-between gap-2 border-b border-border pb-2"
            >
              <span>
                {l.qty} × {l.name} (talla {l.size})
                {l.patches?.length > 0 && (
                  <span className="block text-muted">
                    Parches: {l.patches.map((p) => p.name).join(', ')}
                  </span>
                )}
                {l.custom && (
                  <span className="block text-muted">
                    Personalizada: {describeCustom(l.custom)}
                  </span>
                )}
              </span>
              <span>{formatCRC(l.unitPrice * l.qty)}</span>
            </li>
          ))}
        </ul>
        <Row label="Subtotal">{formatCRC(order.subtotal)}</Row>
        {order.discount > 0 && (
          <Row label={`Descuento${order.couponCode ? ` (${order.couponCode})` : ''}`}>
            −{formatCRC(order.discount)}
          </Row>
        )}
        {order.shipping > 0 && <Row label="Envío">{formatCRC(order.shipping)}</Row>}
        <p className="text-base font-bold">Total: {formatCRC(order.total)}</p>
      </section>

      <section className={`${cardClass} flex flex-col gap-1 text-sm`}>
        <h3 className="mb-1 font-bold">Pagos</h3>
        <Row label="Adelanto requerido">{formatCRC(order.advanceRequired)}</Row>
        <Row label="Pagado">{formatCRC(totalPaid(order))}</Row>
        <Row label="Saldo pendiente">
          <strong>{formatCRC(balance(order))}</strong>
        </Row>
        {order.payments?.length > 0 && (
          <ul className="mt-1 list-disc ps-5">
            {order.payments.map((p, i) => (
              <li key={i}>
                {formatCRC(p.amount)} · comprobante {p.ref} · {formatDateTime(toMillis(p.at))}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* La foto del comprobante solo está mientras no se haya borrado de Drive. */}
      {order.receiptFileId && (
        <section className="flex flex-col gap-3">
          <h3 className="font-bold">Comprobante</h3>
          <Receipt key={order.receiptFileId} order={order} />
        </section>
      )}

      {/* «Comprobar pago» se oculta apenas el pedido queda confirmado. */}
      {canConfirmPayment(current) && (
        <PaymentForm key={current.payments?.length ?? 0} order={current} onSaved={onPaymentSaved} />
      )}

      {/* El recibo aparece (y se manda por correo) solo con el pedido ya confirmado. */}
      {canIssueReceipt(current) && (
        <OrderReceipt
          order={current}
          whatsapp={customerWhatsApp(current, 'confirmado', { origin })}
          follow={paid}
        />
      )}

      {rejectLink && (
        <div className={actionStackClass}>
          <a href={rejectLink} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
            <MdWhatsapp className="size-5" aria-hidden="true" />
            Avisar rechazo
          </a>
        </div>
      )}

      {canReject(order) && (
        <ReasonAction
          label="Rechazar pago"
          icon={MdThumbDown}
          danger
          required
          placeholder="Ej.: el monto no coincide"
          onSubmit={async (reason) => {
            await rejectPayment(order, reason)
            setRejectLink(customerWhatsApp(order, 'rechazado', { origin, reason }))
            done({ type: 'ok', text: 'Pago rechazado. Ya puedes avisar al cliente por WhatsApp.' })
          }}
        />
      )}
      <Notes order={order} />

      {/* Cancelar y eliminar: siempre en una sola línea, al fondo de la pantalla. */}
      {canCancel(order) && cancelOpen && (
        <ReasonForm
          label="Cancelar pedido"
          icon={MdCancel}
          danger
          placeholder="Opcional"
          onClose={() => setCancelOpen(false)}
          onSubmit={async (reason) => {
            await cancelOrder(order, reason)
            setCancelOpen(false)
            done({ type: 'ok', text: 'Pedido cancelado.' })
          }}
        />
      )}
      <div className={actionRowClass}>
        {canCancel(order) && (
          <button
            type="button"
            aria-expanded={cancelOpen}
            onClick={() => setCancelOpen((o) => !o)}
            className={btnDanger}
          >
            <MdCancel className="size-5" aria-hidden="true" />
            Cancelar pedido
          </button>
        )}
        <button
          type="button"
          disabled={deleting}
          onClick={async () => {
            const yes = await dialog.confirm({
              title: 'Eliminar pedido',
              message: `¿Eliminar para siempre el pedido ${orderRef(order.id)}? Se borran también su rastreo, sus notas y el comprobante de Drive. No se puede deshacer.`,
              confirmLabel: 'Eliminar para siempre',
              danger: true,
            })
            if (!yes) return
            setDeleting(true)
            try {
              const { driveFailed } = await deleteOrder(order)
              onDeleted({
                type: driveFailed ? 'error' : 'ok',
                text: driveFailed
                  ? `Pedido ${orderRef(order.id)} eliminado, pero no se pudo borrar la foto del comprobante en Drive.`
                  : `Pedido ${orderRef(order.id)} eliminado.`,
              })
            } catch (e) {
              setNotice({ type: 'error', text: errorMessage(e) })
              setDeleting(false)
            }
          }}
          className={btnDanger}
        >
          <MdDeleteForever className="size-5" aria-hidden="true" />
          {deleting ? 'Eliminando…' : 'Eliminar pedido'}
        </button>
      </div>
    </div>
  )
}

const DEFAULT_ORDER_FILTER = 'pago_pendiente_revision'

function OrderList({ orders, onOpen }) {
  const [status, setStatus] = useState(DEFAULT_ORDER_FILTER)
  const [query, setQuery] = useState('')
  const counts = countByStatus(orders)
  const shown = filterOrders(orders, { status, query })

  const options = [['all', 'Todos'], ...Object.entries(ORDER_STATUS)]

  return (
    <div className="flex flex-col gap-4">
      <FilterPanel
        gridClass="sm:grid-cols-1"
        active={Boolean(query) || status !== DEFAULT_ORDER_FILTER}
        onClear={() => {
          setQuery('')
          setStatus(DEFAULT_ORDER_FILTER)
        }}
        search={
          <Field label="Buscar" hint="Referencia, nombre o teléfono.">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={inputClass}
            />
          </Field>
        }
      >
        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            {options.map(([value, label]) => (
              <option key={value} value={value}>
                {label} ({counts[value] ?? 0})
              </option>
            ))}
          </select>
        </Field>
      </FilterPanel>

      {shown.length === 0 ? (
        <EmptyState>No hay pedidos con ese filtro.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onOpen(o.id)}
                className={`${cardClass} flex w-full flex-wrap items-center justify-between gap-2 text-start hover:border-accent`}
              >
                <span className="flex flex-col">
                  <span className="font-bold">
                    {orderRef(o.id)} · {o.customer?.name}
                  </span>
                  <span className="text-sm text-muted">
                    {formatDateTime(toMillis(o.createdAt))} · {formatCRC(o.total)} · pagado{' '}
                    {formatCRC(totalPaid(o))}
                  </span>
                </span>
                <StatusBadge status={o.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-center gap-1 text-xs text-muted">
        <MdDeleteSweep className="size-4" aria-hidden="true" />
        Se muestran los 200 pedidos más recientes. &quot;Todos&quot; oculta los cancelados.
      </p>
    </div>
  )
}

/** Bandeja de pedidos y detalle con revisión de pagos. */
export default function OrdersPage() {
  const { data, loading, error, reload } = useAsync(load)
  const [openId, setOpenId] = useState(null)
  const [notice, setNotice] = useState(null)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const order = data.find((o) => o.id === openId)

  return order ? (
    <OrderDetail
      order={order}
      onBack={() => setOpenId(null)}
      onChanged={reload}
      onDeleted={(n) => {
        setNotice(n)
        setOpenId(null)
        reload()
      }}
    />
  ) : (
    <div className="flex flex-col gap-4">
      <Notice notice={notice} />
      <OrderList orders={data} onOpen={setOpenId} />
    </div>
  )
}
