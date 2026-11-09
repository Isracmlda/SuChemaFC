import { SHIPPING_METHODS, orderRef } from '../../checkout/checkout.js'
import { describeCustom } from '../../personalization/personalization.js'
import { toMillis } from '../../../utils/dates.js'
import { balance, totalPaid } from '../orders/review.js'
import { buildQrPayload } from '../delivery/delivery.js'

const REPLACEMENTS = [
  [/[\u2018\u2019]/g, "'"],
  [/[\u201C\u201D]/g, '"'],
  [/[\u2013\u2014]/g, '-'],
  [/\u2026/g, '...'],
  [/\u20A1/g, 'CRC '],
]

/** Texto apto para las fuentes estándar del PDF (solo Latin-1). Lo demás se cambia por "?". */
export function pdfText(value) {
  let text = String(value ?? '').normalize('NFC')
  for (const [pattern, replacement] of REPLACEMENTS) text = text.replace(pattern, replacement)
  return text.replace(/[^\x20-\x7E\xA1-\xFF]/g, '?')
}

/** Monto en colones con espacios como separador de miles (sin el símbolo ₡, que el PDF no dibuja). */
export const pdfMoney = (amount) =>
  `CRC ${String(Math.round(Number(amount) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`

/** Datos del recibo, listos para dibujar. No depende de jsPDF para poder probarse. */
export function buildReceiptModel(order) {
  const items = order.lines.map((line, index) => {
    const extras = [
      ...(line.patches ?? []).map((p) => `Parche: ${p.name}`),
      line.custom ? `Personalizada: ${describeCustom(line.custom)}` : '',
    ].filter(Boolean)
    return {
      index,
      qrPayload: buildQrPayload(order.id, index),
      name: pdfText(line.name),
      size: pdfText(line.size),
      qty: line.qty,
      extras: extras.map(pdfText),
      unitPrice: line.unitPrice,
      lineTotal: line.unitPrice * line.qty,
    }
  })
  return {
    ref: orderRef(order.id),
    createdAt: toMillis(order.createdAt),
    customerName: pdfText(order.customer?.name),
    phone: pdfText(order.customer?.phone),
    delivery: pdfText(SHIPPING_METHODS[order.shippingMethod] ?? ''),
    items,
    totals: {
      subtotal: order.subtotal,
      discount: order.discount ?? 0,
      shipping: order.shipping ?? 0,
      total: order.total,
      paid: totalPaid(order),
      balance: balance(order),
    },
  }
}
