import { statusLabel } from '../../orders/orderStatus.js'
import { formatCRC } from '../../../utils/format.js'
import { balance, normalizeReference, totalPaid, validatePaymentForm } from '../orders/review.js'

const PREFIX = 'SCFC'

/** Texto del QR: identifica el pedido y la camisa (posición dentro de `lines`). */
export const buildQrPayload = (orderId, lineIndex) => `${PREFIX}:${orderId}:${lineIndex}`

/** Lee el texto de un QR. Devuelve { orderId, lineIndex } o null si no es de SuChemaFC. */
export function parseQrPayload(text = '') {
  const m = String(text)
    .trim()
    .match(/^SCFC:([A-Za-z0-9]{10,40}):(\d{1,2})$/)
  return m ? { orderId: m[1], lineIndex: Number(m[2]) } : null
}

/**
 * Lo que el admin puede escribir a mano: el texto del QR, el ID completo del pedido (20
 * caracteres) o su referencia corta de 8. Devuelve { orderId, lineIndex } o { ref } o null.
 */
export function parseScanInput(text = '') {
  const qr = parseQrPayload(text)
  if (qr) return qr
  const value = String(text).trim()
  if (/^[A-Za-z0-9]{20}$/.test(value)) return { orderId: value, lineIndex: null }
  if (/^[A-Za-z0-9]{8}$/.test(value)) return { ref: value.toUpperCase() }
  return null
}

export const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'sinpe', label: 'SINPE Móvil' },
]

/** Motivo por el que no se puede entregar, o '' si se puede. */
export function deliveryBlock(order) {
  if (order.deleted || order.status === 'cancelado') return 'Este pedido está cancelado.'
  if (order.status === 'entregado') return 'Este pedido ya fue entregado.'
  if (['pago_pendiente_revision', 'pago_rechazado'].includes(order.status)) {
    return 'El adelanto aún no está confirmado. Revisa el pago en la pestaña Pedidos.'
  }
  return ''
}

/** Aviso (no bloquea) cuando el pedido todavía no figura como listo para entrega. */
export const deliveryWarning = (order) =>
  order.status === 'listo_para_entrega'
    ? ''
    : `El pedido figura como "${statusLabel(order.status)}", no como listo para entrega.`

/** Error del formulario de entrega ('' si es válido). `checked` son las posiciones verificadas. */
export function validateDelivery(order, { checked, method, amount, reference }) {
  const blocked = deliveryBlock(order)
  if (blocked) return blocked
  const lines = order.lines.length
  if (new Set(checked).size !== lines) return 'Revisa y marca todas las camisas del pedido.'

  const pending = balance(order)
  if (pending === 0) return ''
  if (!PAYMENT_METHODS.some((m) => m.value === method)) return 'Elige cómo se cobra el saldo.'
  if (amount !== pending) return `Debes cobrar el saldo completo (${formatCRC(pending)}).`
  if (method === 'sinpe') return validatePaymentForm(order, { reference, amount })
  return ''
}

/**
 * Resultado de entregar: pagos con el saldo cobrado (si había), total pagado y estado final.
 * `ref` es el número de comprobante solo para SINPE (se registra en `paymentRefs`).
 */
export function applyDelivery(order, { method, reference }, at) {
  const pending = balance(order)
  const ref = pending > 0 && method === 'sinpe' ? normalizeReference(reference) : ''
  const payments =
    pending > 0
      ? [...(order.payments ?? []), { amount: pending, ref: ref || 'EFECTIVO', method, at }]
      : (order.payments ?? [])
  return {
    payments,
    paidAmount: totalPaid({ payments }),
    status: 'entregado',
    ref,
    collected: pending,
  }
}
