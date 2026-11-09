import { formatCRC } from '../../../utils/format.js'
import { orderRef, trackingUrl, whatsappLink } from '../../checkout/checkout.js'
import { FINAL_STATUSES } from '../../orders/orderStatus.js'

const REFERENCE = /^[A-Z0-9-]{4,40}$/

/** Estados en los que el adelanto todavía no está confirmado: el pago se está revisando. */
const AWAITING_REVIEW = ['pago_pendiente_revision', 'pago_rechazado']

/** Número de comprobante en mayúsculas y sin espacios ni guiones raros (es el ID de `paymentRefs`). */
export const normalizeReference = (text = '') =>
  String(text)
    .trim()
    .toUpperCase()
    .replace(/[\s_.]+/g, '')

/** Pagos registrados (suma de `payments`), con un pedido sin ese campo tratado como vacío. */
export const totalPaid = (order) =>
  (order.payments ?? []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

/** Lo que falta por pagar del total del pedido. */
export const balance = (order) => Math.max(0, order.total - totalPaid(order))

/** Lo que falta para cubrir el adelanto mínimo. */
export const advanceMissing = (order) => Math.max(0, order.advanceRequired - totalPaid(order))

/** Error de texto para el formulario de "Comprobar", o '' si es válido. */
export function validatePaymentForm(order, { reference, amount }) {
  const ref = normalizeReference(reference)
  if (!REFERENCE.test(ref)) {
    return 'Escribe el número de comprobante (4 a 40 letras, números o guiones).'
  }
  if (!Number.isInteger(amount) || amount <= 0) return 'Escribe el monto recibido.'
  if (amount > balance(order)) {
    return `El monto supera el saldo pendiente (${formatCRC(balance(order))}).`
  }
  return ''
}

/**
 * Resultado de registrar un pago: la lista de pagos, el total pagado y el estado nuevo.
 * El adelanto se confirma cuando lo pagado alcanza `advanceRequired`; un pago menor solo se
 * registra (pago parcial). Un pedido ya avanzado conserva su estado.
 */
export function applyPayment(order, { reference, amount }, at) {
  const ref = normalizeReference(reference)
  const payments = [...(order.payments ?? []), { amount, ref, at }]
  const paidAmount = totalPaid({ payments })
  const confirms = AWAITING_REVIEW.includes(order.status) && paidAmount >= order.advanceRequired
  return {
    ref,
    payments,
    paidAmount,
    status: confirms ? 'adelanto_confirmado' : order.status,
    statusChanged: confirms,
  }
}

/** Una línea de historial del pedido (la hora usa el reloj del equipo: no se permite serverTimestamp en listas). */
export const timelineEntry = (status, at, note = '') => ({ status, at, note: note.trim() })

export const canCancel = (order) => !order.deleted && !FINAL_STATUSES.includes(order.status)
export const canReject = (order) => order.status === 'pago_pendiente_revision'
/** "Comprobar pago" solo mientras el adelanto no se confirma; después el saldo se cobra al entregar. */
export const canConfirmPayment = (order) =>
  !order.deleted && AWAITING_REVIEW.includes(order.status) && balance(order) > 0
/** El recibo se emite una vez que el pago se comprobó y el pedido quedó confirmado. */
export const canIssueReceipt = (order) =>
  !order.deleted && order.status !== 'cancelado' && !AWAITING_REVIEW.includes(order.status)

/** Filtra por estado (`all` = todos menos cancelados) y por texto (referencia, nombre o teléfono). */
export function filterOrders(orders, { status = 'all', query = '' } = {}) {
  const q = query.trim().toLowerCase()
  return orders.filter((o) => {
    if (status === 'all' ? o.deleted : o.status !== status) return false
    if (!q) return true
    const haystack = [orderRef(o.id), o.customer?.name, o.customer?.phone].join(' ').toLowerCase()
    return haystack.includes(q)
  })
}

/** Cantidad de pedidos por estado (los cancelados no cuentan en `all`). */
export function countByStatus(orders) {
  const counts = { all: 0 }
  for (const o of orders) {
    counts[o.status] = (counts[o.status] ?? 0) + 1
    if (!o.deleted) counts.all += 1
  }
  return counts
}

/** Mensaje de WhatsApp para el cliente según lo que pasó con su pago. */
export function buildCustomerMessage(kind, order, { origin, reason = '' } = {}) {
  const link = trackingUrl(origin, order.trackingCode)
  const hello = `Hola ${order.customer.name}, te escribimos de SuChemaFC sobre tu pedido ${orderRef(order.id)}.`
  const follow = `Puedes ver el estado aquí: ${link}`
  if (kind === 'confirmado') {
    const pending = balance(order)
    return [
      hello,
      `Confirmamos tu pago. Total recibido: ${formatCRC(totalPaid(order))}.`,
      pending > 0
        ? `Saldo pendiente: ${formatCRC(pending)}.`
        : 'Tu pedido está pagado por completo.',
      follow,
    ].join('\n')
  }
  if (kind === 'rechazado') {
    return [
      hello,
      `No pudimos confirmar tu pago${reason ? `: ${reason}` : '.'}`,
      'Si ya pagaste, envíanos de nuevo tu comprobante por este chat.',
      follow,
    ].join('\n')
  }
  return [hello, reason, follow].filter(Boolean).join('\n')
}

/** Enlace wa.me al cliente, o '' si el teléfono no sirve. */
export const customerWhatsApp = (order, kind, options) =>
  whatsappLink(order.customer?.phone, buildCustomerMessage(kind, order, options))
