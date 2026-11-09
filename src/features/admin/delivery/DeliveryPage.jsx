import { useCallback, useState } from 'react'
import { MdCheckBox, MdCheckBoxOutlineBlank, MdLocalShipping, MdSearch } from 'react-icons/md'
import Field from '../../../components/Field.jsx'
import StatusBadge from '../../../components/StatusBadge.jsx'
import { InlineNotice, Notice } from '../../../components/States.jsx'
import { listOrders } from '../../../services/adminOrders.js'
import { deliverOrder, fetchOrder, fetchOrderByTracking } from '../../../services/delivery.js'
import { errorMessage } from '../../../utils/errors.js'
import { formatCRC } from '../../../utils/format.js'
import { btnPrimary, btnSecondary, cardClass, inputClass } from '../../../utils/ui.js'
import { SHIPPING_METHODS, orderRef } from '../../checkout/checkout.js'
import { describeCustom } from '../../personalization/personalization.js'
import { balance, totalPaid } from '../orders/review.js'
import {
  PAYMENT_METHODS,
  deliveryBlock,
  deliveryWarning,
  parseScanInput,
  validateDelivery,
} from './delivery.js'
import QrScanner from './QrScanner.jsx'

/** Busca el pedido según lo escaneado o escrito. Devuelve { order, lineIndex } o lanza un error. */
async function findOrder(input) {
  const parsed = parseScanInput(input)
  if (!parsed)
    throw new Error(
      'Ese código no es de SuChemaFC. Escanea el QR del recibo o escribe la referencia.',
    )
  // La referencia son los 8 primeros caracteres del ID en mayúsculas: se busca entre los recientes.
  let order
  if (parsed.trackingCode) order = await fetchOrderByTracking(parsed.trackingCode)
  else if (parsed.orderId) order = await fetchOrder(parsed.orderId)
  else order = (await listOrders()).find((o) => orderRef(o.id) === parsed.ref) ?? null
  if (!order) throw new Error('No se encontró ese pedido.')
  const lineIndex =
    parsed.lineIndex != null && parsed.lineIndex < order.lines.length ? parsed.lineIndex : null
  return { order, lineIndex }
}

/**
 * `scanned` son las camisas (posiciones) escaneadas con sus etiquetas: quedan verificadas solas.
 * El admin puede marcar o desmarcar cualquiera a mano (`flipped` guarda esos cambios).
 */
function DeliveryForm({ order, scanned, onDone }) {
  const [flipped, setFlipped] = useState([])
  const [method, setMethod] = useState('efectivo')
  const [reference, setReference] = useState('')
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const checked = order.lines
    .map((_, i) => i)
    .filter((i) => scanned.includes(i) !== flipped.includes(i))
  const pending = balance(order)
  const blocked = deliveryBlock(order)
  const warning = deliveryWarning(order)
  const problem = validateDelivery(order, { checked, method, amount: pending, reference })

  const toggle = (i) => setFlipped((f) => (f.includes(i) ? f.filter((x) => x !== i) : [...f, i]))

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      await deliverOrder(order, { method, reference })
      onDone()
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) })
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">Pedido {orderRef(order.id)}</h2>
        <StatusBadge status={order.status} />
      </div>
      <p className="text-sm">
        {order.customer?.name} · {order.customer?.phone} · {SHIPPING_METHODS[order.shippingMethod]}
      </p>
      {blocked && <InlineNotice notice={{ type: 'error', text: blocked }} />}
      {!blocked && warning && <p className="text-sm text-muted">⚠ {warning}</p>}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Verifica cada camisa antes de entregar</legend>
        {scanned.length > 0 && (
          <p className="text-sm text-muted">
            Etiquetas escaneadas: {scanned.length} de {order.lines.length}. Escanea las demás o
            márcalas a mano.
          </p>
        )}
        {order.lines.map((l, i) => {
          const on = checked.includes(i)
          const Icon = on ? MdCheckBox : MdCheckBoxOutlineBlank
          return (
            <button
              key={i}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={Boolean(blocked)}
              onClick={() => toggle(i)}
              className={`${cardClass} flex min-h-11 items-center gap-3 text-start disabled:opacity-60 ${
                scanned.includes(i) ? 'border-accent' : ''
              }`}
            >
              <Icon className="size-6 shrink-0 text-accent" aria-hidden="true" />
              <span>
                <span className="font-semibold">
                  {l.qty} × {l.name} (talla {l.size})
                </span>
                {l.patches?.length > 0 && (
                  <span className="block text-sm text-muted">
                    Parches: {l.patches.map((p) => p.name).join(', ')}
                  </span>
                )}
                {l.custom && (
                  <span className="block text-sm text-muted">
                    Personalizada: {describeCustom(l.custom)}
                  </span>
                )}
                {scanned.includes(i) && (
                  <span className="block text-sm text-accent">Escaneada</span>
                )}
              </span>
            </button>
          )
        })}
      </fieldset>

      <div className={`${cardClass} flex flex-col gap-1 text-sm`}>
        <p>Total: {formatCRC(order.total)}</p>
        <p>Pagado: {formatCRC(totalPaid(order))}</p>
        <p className="text-base font-bold">Saldo por cobrar: {formatCRC(pending)}</p>
      </div>

      {pending > 0 && !blocked && (
        <div className={`${cardClass} flex flex-col gap-3`}>
          <h3 className="font-bold">Cobro del saldo</h3>
          <div role="radiogroup" aria-label="Forma de cobro" className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((m) => (
              <label
                key={m.value}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                  method === m.value ? 'border-accent bg-surface-2' : 'border-border-strong'
                }`}
              >
                <input
                  type="radio"
                  name="cobro"
                  value={m.value}
                  checked={method === m.value}
                  onChange={() => setMethod(m.value)}
                  className="accent-[var(--accent-solid)]"
                />
                {m.label}
              </label>
            ))}
          </div>
          {method === 'sinpe' && (
            <Field label="Número de comprobante SINPE" hint="Debe ser único.">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                autoComplete="off"
                className={`${inputClass} font-mono`}
              />
            </Field>
          )}
        </div>
      )}

      {!blocked && problem && <p className="text-sm text-danger">⚠ {problem}</p>}
      <Notice notice={notice} />
      <button type="submit" disabled={busy || Boolean(problem)} className={btnPrimary}>
        <MdLocalShipping className="size-5" aria-hidden="true" />
        {busy
          ? 'Guardando…'
          : pending > 0
            ? `Cobrar ${formatCRC(pending)} y entregar`
            : 'Marcar como entregado'}
      </button>
    </form>
  )
}

/** Entrega: escanear el QR del recibo, verificar las camisas, cobrar el saldo y cerrar el pedido. */
export default function DeliveryPage() {
  const [manual, setManual] = useState('')
  const [found, setFound] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  // Si se escanea otra etiqueta del mismo pedido, se suma a las camisas ya escaneadas.
  const lookup = useCallback(async (input) => {
    setBusy(true)
    setError('')
    setDone(null)
    try {
      const next = await findOrder(input)
      setFound((prev) => {
        const before = prev?.order.id === next.order.id ? prev.scanned : []
        const add = next.lineIndex == null ? [] : [next.lineIndex]
        return { order: next.order, scanned: [...new Set([...before, ...add])] }
      })
    } catch (e) {
      setFound(null)
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }, [])

  function submitManual(event) {
    event.preventDefault()
    lookup(manual)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <section className="flex flex-col gap-3" aria-labelledby="scan-title">
        <h2 id="scan-title" className="text-lg font-bold">
          Entregar un pedido
        </h2>
        <QrScanner onScan={lookup} />
        <form onSubmit={submitManual} className="flex flex-wrap items-end gap-2">
          <Field
            label="O escribe el código"
            hint="El texto del QR, la guía de rastreo, el ID del pedido o su referencia de 8 caracteres."
            className="min-w-60 flex-1"
          >
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              autoComplete="off"
              spellCheck="false"
              className={`${inputClass} font-mono`}
            />
          </Field>
          <button type="submit" disabled={busy || !manual.trim()} className={btnSecondary}>
            <MdSearch className="size-5" aria-hidden="true" />
            Buscar
          </button>
        </form>
        {busy && (
          <p role="status" className="text-muted">
            Buscando…
          </p>
        )}
        {error && <Notice notice={{ type: 'error', text: error }} />}
      </section>

      {done && <Notice notice={{ type: 'ok', text: done }} />}
      {found && (
        <DeliveryForm
          key={found.order.id}
          order={found.order}
          scanned={found.scanned}
          onDone={() => {
            setDone(`Pedido ${orderRef(found.order.id)} entregado.`)
            setFound(null)
            setManual('')
          }}
        />
      )}
    </div>
  )
}
